package com.timedelay.app.plugins.camera

import android.Manifest
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * Capacitor plugin that records the camera via CameraX VideoCapture API (H.264)
 * and writes segmented MP4 files to local storage.
 *
 * Uses CameraX's built-in VideoCapture + Recorder, which handles all MediaCodec
 * and surface management internally. Segments are produced by stopping and
 * restarting recordings at fixed intervals.
 *
 * JS interface:
 *   - startRecording({ sessionId, width, height, fps, segmentDurationMs })
 *   - stopRecording()
 *
 * JS events emitted:
 *   - segmentReady  { sessionId, path, timestamp, index }
 *   - thumbnailReady { sessionId, path, timestamp }
 *   - recordingError { error }
 */
@CapacitorPlugin(
    name = "CameraRecorder",
    permissions = [
        Permission(
            strings = [Manifest.permission.CAMERA],
            alias = "camera"
        )
    ]
)
class CameraRecorderPlugin : Plugin() {

    companion object {
        private const val TAG = "CameraRecorderPlugin"
    }

    // Camera
    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null

    // Recording
    private var activeRecording: Recording? = null
    private var segmentIndex = 0
    private var sessionStartTimeMs = 0L
    private var segmentDurationMs = 1000L
    private var sessionsDir: File? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var segmentRotationRunnable: Runnable? = null
    private val thumbnailExecutor = Executors.newSingleThreadExecutor()

    // State
    private var isRecording = false
    private var currentSessionId: String? = null
    private var isStopping = false  // Prevent double-rotation during stop

    // ----- Plugin Methods -----

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (isRecording) {
            call.reject("Already recording")
            return
        }

        currentSessionId = call.getString("sessionId") ?: run {
            call.reject("sessionId is required")
            return
        }

        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }

        doStartRecording(call)
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            doStartRecording(call)
        } else {
            call.reject("Camera permission denied")
        }
    }

    private fun doStartRecording(call: PluginCall) {
        val sessionId = currentSessionId ?: return call.reject("No sessionId")
        segmentDurationMs = call.getInt("segmentDurationMs", 2000)!!.toLong()

        // Create session directory
        sessionsDir = File(context.filesDir, "sessions/$sessionId")
        sessionsDir!!.mkdirs()

        segmentIndex = 0
        sessionStartTimeMs = System.currentTimeMillis()
        isStopping = false

        try {
            startCameraAndRecording(sessionId)

            isRecording = true

            val result = JSObject().apply {
                put("success", true)
                // CameraX VideoCapture produces self-contained MP4s, no separate init segment needed.
                // We pass an empty string — player.ts will handle this.
                put("initSegmentPath", "")
            }
            call.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            call.reject("Failed to start recording: ${e.message}")
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        if (!isRecording) {
            call.reject("Not recording")
            return
        }

        isStopping = true

        // CameraX MUST be operated from the main thread.
        // Capacitor plugin methods run on a background thread,
        // so we post to mainHandler and synchronize via CountDownLatch.
        val latch = java.util.concurrent.CountDownLatch(1)
        var stopError: Exception? = null

        mainHandler.post {
            try {
                // Cancel segment rotation
                segmentRotationRunnable?.let { mainHandler.removeCallbacks(it) }
                segmentRotationRunnable = null

                // Stop current recording
                activeRecording?.stop()
                activeRecording = null

                // Unbind camera — must be on main thread
                cameraProvider?.unbindAll()
                cameraProvider = null
                videoCapture = null
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping recording", e)
                stopError = e
            } finally {
                isRecording = false
                currentSessionId = null
                latch.countDown()
            }
        }

        // Wait for the main-thread work to complete (with timeout)
        try {
            latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        } catch (_: InterruptedException) {}

        if (stopError != null) {
            call.reject("Error stopping: ${stopError!!.message}")
        } else {
            call.resolve(JSObject().apply { put("success", true) })
        }
    }

    // ----- CameraX VideoCapture Setup -----

    private fun startCameraAndRecording(sessionId: String) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()

                // Build Recorder with HD quality
                val recorder = Recorder.Builder()
                    .setQualitySelector(QualitySelector.from(Quality.HD))
                    .setExecutor(Executors.newSingleThreadExecutor())
                    .build()

                videoCapture = VideoCapture.withOutput(recorder)

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider?.unbindAll()
                cameraProvider?.bindToLifecycle(
                    activity as LifecycleOwner,
                    cameraSelector,
                    videoCapture!!
                )

                Log.d(TAG, "CameraX bound with VideoCapture")

                // Start the first segment
                startNewSegment(sessionId)

                // Schedule segment rotation
                scheduleSegmentRotation(sessionId)

            } catch (e: Exception) {
                Log.e(TAG, "CameraX setup failed", e)
                val event = JSObject().apply { put("error", "Camera setup failed: ${e.message}") }
                notifyListeners("recordingError", event)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun startNewSegment(sessionId: String) {
        if (isStopping || videoCapture == null) return

        segmentIndex++
        val segFile = File(sessionsDir, "segment_%04d.mp4".format(segmentIndex))
        val outputOptions = FileOutputOptions.Builder(segFile).build()

        val recorder = videoCapture!!.output

        try {
            activeRecording = recorder
                .prepareRecording(context, outputOptions)
                .start(ContextCompat.getMainExecutor(context)) { event ->
                    when (event) {
                        is VideoRecordEvent.Finalize -> {
                            if (event.hasError()) {
                                Log.e(TAG, "Segment $segmentIndex error: ${event.error}")
                            } else {
                                val timestamp = sessionStartTimeMs + ((segmentIndex - 1) * segmentDurationMs)
                                Log.d(TAG, "Segment $segmentIndex finalized: ${segFile.absolutePath}")

                                // Notify JS about the new segment
                                val segEvent = JSObject().apply {
                                    put("sessionId", sessionId)
                                    put("path", segFile.absolutePath)
                                    put("timestamp", timestamp)
                                    put("index", segmentIndex)
                                }
                                notifyListeners("segmentReady", segEvent)

                                // Generate thumbnail on background thread
                                thumbnailExecutor.execute {
                                    generateThumbnail(segFile.absolutePath, sessionId, timestamp)
                                }
                            }
                        }
                    }
                }
            Log.d(TAG, "Started segment $segmentIndex")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start segment $segmentIndex", e)
        }
    }

    private fun scheduleSegmentRotation(sessionId: String) {
        segmentRotationRunnable = object : Runnable {
            override fun run() {
                if (!isRecording || isStopping) return

                // Stop current segment (this triggers Finalize callback)
                activeRecording?.stop()
                activeRecording = null

                // Small delay to let CameraX finalize, then start next segment
                mainHandler.postDelayed({
                    if (isRecording && !isStopping) {
                        startNewSegment(sessionId)
                        mainHandler.postDelayed(this, segmentDurationMs)
                    }
                }, 200)  // 200ms gap between segments
            }
        }
        mainHandler.postDelayed(segmentRotationRunnable!!, segmentDurationMs)
    }

    // ----- Thumbnail Generation -----

    private fun generateThumbnail(segmentPath: String, sessionId: String, timestamp: Long) {
        try {
            val retriever = android.media.MediaMetadataRetriever()
            retriever.setDataSource(segmentPath)
            val bitmap = retriever.getFrameAtTime(0, android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            retriever.release()

            if (bitmap != null) {
                val scale = minOf(160f / bitmap.width, 90f / bitmap.height)
                val w = (bitmap.width * scale).toInt()
                val h = (bitmap.height * scale).toInt()
                val scaled = Bitmap.createScaledBitmap(bitmap, w, h, true)

                val thumbDir = File(context.filesDir, "sessions/$sessionId/thumbnails")
                thumbDir.mkdirs()
                val thumbFile = File(thumbDir, "thumb_${timestamp}.jpg")
                FileOutputStream(thumbFile).use { out ->
                    scaled.compress(Bitmap.CompressFormat.JPEG, 70, out)
                }
                scaled.recycle()
                bitmap.recycle()

                val event = JSObject().apply {
                    put("sessionId", sessionId)
                    put("path", thumbFile.absolutePath)
                    put("timestamp", timestamp)
                }
                notifyListeners("thumbnailReady", event)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Thumbnail generation failed for $segmentPath", e)
        }
    }
}
