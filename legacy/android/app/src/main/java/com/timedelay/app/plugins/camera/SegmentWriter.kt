package com.timedelay.app.plugins.camera

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

/**
 * Writes H.264-encoded video data into segmented MP4 files.
 *
 * Usage:
 *   1. Call [start] once to begin a new session.
 *   2. For every encoded buffer from MediaCodec, call [writeSample].
 *      It automatically handles init-segment extraction and segment rotation.
 *   3. Call [stop] when recording is finished.
 *
 * The writer produces:
 *   - An init segment (`init.mp4`) containing only the moov/ftyp atoms
 *   - Numbered segment files (`segment_NNNN.mp4`), each ~[segmentDurationMs] long
 */
class SegmentWriter(
    private val sessionDir: File,
    private val segmentDurationMs: Long = 1000L,
    private val onSegmentReady: (path: String, timestamp: Long, index: Int) -> Unit,
    private val onInitSegmentReady: (path: String) -> Unit
) {
    companion object {
        private const val TAG = "SegmentWriter"
    }

    private var muxer: MediaMuxer? = null
    private var trackIndex = -1
    private var segmentIndex = 0
    private var segmentStartTimeUs = 0L
    private var currentSegmentFile: File? = null
    private var sessionStartTimeMs = 0L
    private var initSegmentWritten = false
    private var outputFormat: MediaFormat? = null

    /**
     * Initialise the writer. Creates the session directory.
     */
    fun start() {
        if (!sessionDir.exists()) sessionDir.mkdirs()
        segmentIndex = 0
        sessionStartTimeMs = System.currentTimeMillis()
        segmentStartTimeUs = -1L
        initSegmentWritten = false
        Log.d(TAG, "SegmentWriter started, dir=${sessionDir.absolutePath}")
    }

    /**
     * Called when MediaCodec signals INFO_OUTPUT_FORMAT_CHANGED.
     * Writes the init segment (a tiny MP4 with just the codec config).
     */
    fun setOutputFormat(format: MediaFormat) {
        outputFormat = format

        // Write a tiny init-only MP4 containing just the moov atom
        if (!initSegmentWritten) {
            val initFile = File(sessionDir, "init.mp4")
            try {
                val initMuxer = MediaMuxer(initFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                val idx = initMuxer.addTrack(format)
                initMuxer.start()
                // Write a zero-length sample so the muxer writes moov
                val emptyBuf = ByteBuffer.allocate(0)
                val info = MediaCodec.BufferInfo().apply {
                    offset = 0
                    size = 0
                    presentationTimeUs = 0
                    flags = MediaCodec.BUFFER_FLAG_END_OF_STREAM
                }
                initMuxer.writeSampleData(idx, emptyBuf, info)
                initMuxer.stop()
                initMuxer.release()
                initSegmentWritten = true
                onInitSegmentReady(initFile.absolutePath)
                Log.d(TAG, "Init segment written: ${initFile.absolutePath}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to write init segment", e)
            }
        }

        // Start the first content segment
        startNewSegment()
    }

    /**
     * Write an encoded sample. Automatically rotates to a new segment when
     * the current one exceeds [segmentDurationMs].
     */
    fun writeSample(buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
        if (muxer == null || trackIndex < 0) return

        // Initialise segmentStartTimeUs on the very first sample
        if (segmentStartTimeUs < 0) {
            segmentStartTimeUs = info.presentationTimeUs
        }

        val elapsedUs = info.presentationTimeUs - segmentStartTimeUs

        // Rotate segment if duration exceeded AND this is a key frame (clean cut)
        if (elapsedUs >= segmentDurationMs * 1000 &&
            (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0
        ) {
            finishCurrentSegment()
            startNewSegment()
            segmentStartTimeUs = info.presentationTimeUs
        }

        try {
            muxer?.writeSampleData(trackIndex, buffer, info)
        } catch (e: Exception) {
            Log.e(TAG, "Error writing sample data", e)
        }
    }

    /**
     * Stop recording and finalise the last segment.
     */
    fun stop() {
        finishCurrentSegment()
        Log.d(TAG, "SegmentWriter stopped. Total segments: $segmentIndex")
    }

    private fun startNewSegment() {
        val format = outputFormat ?: return
        segmentIndex++
        val segFile = File(sessionDir, "segment_%04d.mp4".format(segmentIndex))
        currentSegmentFile = segFile
        try {
            muxer = MediaMuxer(segFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            trackIndex = muxer!!.addTrack(format)
            muxer!!.start()
            Log.d(TAG, "Started segment $segmentIndex: ${segFile.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start segment $segmentIndex", e)
            muxer = null
            trackIndex = -1
        }
    }

    private fun finishCurrentSegment() {
        try {
            muxer?.stop()
            muxer?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error finishing segment $segmentIndex", e)
        }
        muxer = null
        trackIndex = -1

        currentSegmentFile?.let { file ->
            if (file.exists() && file.length() > 0) {
                val timestamp = sessionStartTimeMs + ((segmentIndex - 1) * segmentDurationMs)
                onSegmentReady(file.absolutePath, timestamp, segmentIndex)
            }
        }
    }
}
