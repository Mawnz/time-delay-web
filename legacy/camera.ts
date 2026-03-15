import { DB } from './db';
import { generateThumbnail } from './thumbnail';
import { MIME_TYPE } from './config';
import { isNative } from './platform';
import { registerPlugin } from '@capacitor/core';

// Native camera plugin interface
interface CameraRecorderPlugin {
    startRecording(options: {
        sessionId: string;
        width: number;
        height: number;
        fps: number;
        segmentDurationMs: number;
    }): Promise<{ success: boolean; initSegmentPath: string }>;

    stopRecording(): Promise<{ success: boolean }>;

    addListener(
        event: 'segmentReady',
        callback: (data: { sessionId: string; path: string; timestamp: number; index: number }) => void
    ): Promise<{ remove: () => void }>;

    addListener(
        event: 'thumbnailReady',
        callback: (data: { sessionId: string; path: string; timestamp: number }) => void
    ): Promise<{ remove: () => void }>;

    addListener(
        event: 'recordingError',
        callback: (data: { error: string }) => void
    ): Promise<{ remove: () => void }>;
}

// Register native plugin (only resolves when running in Capacitor)
const CameraRecorder = registerPlugin<CameraRecorderPlugin>('CameraRecorder');

export class Camera {
    private stream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private isFirstChunk: boolean = true;
    private listenerRemovers: Array<{ remove: () => void }> = [];

    constructor(
        private liveVideoElement: HTMLVideoElement,
        private db: DB,
        private sessionId: string
    ) {}

    async start() {
        if (isNative()) {
            await this.startNative();
        } else {
            await this.startWeb();
        }
    }

    stop() {
        if (isNative()) {
            this.stopNative();
        } else {
            this.stopWeb();
        }
    }

    // ==========================================
    // NATIVE PATH — CameraX + Hardware H.264
    // ==========================================

    private async startNative() {
        try {
            // Listen for segment events from the native plugin
            const segListener = await CameraRecorder.addListener('segmentReady', async (event) => {
                // Store segment reference (file path) in IDB
                await this.db.addSegmentRef(this.sessionId, event.path, event.timestamp);
            });
            this.listenerRemovers.push(segListener);

            const thumbListener = await CameraRecorder.addListener('thumbnailReady', async (event) => {
                // Store thumbnail file path in IDB
                await this.db.addThumbnailRef(this.sessionId, event.path, event.timestamp);
            });
            this.listenerRemovers.push(thumbListener);

            const errorListener = await CameraRecorder.addListener('recordingError', (event) => {
                console.error('Native recording error:', event.error);
            });
            this.listenerRemovers.push(errorListener);

            // Start native recording
            const result = await CameraRecorder.startRecording({
                sessionId: this.sessionId,
                width: 1280,
                height: 720,
                fps: 60,
                segmentDurationMs: 2000, // 2s segments — CameraX stop/start has ~200ms gap
            });

            if (result.success) {
                // CameraX VideoCapture produces self-contained MP4s,
                // no separate init segment needed. Store empty marker.
                if (result.initSegmentPath) {
                    await this.db.addInitSegmentPath(this.sessionId, result.initSegmentPath);
                }

                // Sync session creation time to now (matches web behavior)
                await this.db.updateSessionStartTime(this.sessionId, Date.now());

                console.log('Native recording started');
            }
        } catch (error) {
            console.error('Error starting native camera:', error);
            alert('Could not start camera. Please ensure you have given permission.');
        }
    }

    private async stopNative() {
        try {
            await CameraRecorder.stopRecording();
        } catch (e) {
            console.error('Error stopping native recording:', e);
        }

        // Remove all event listeners
        for (const listener of this.listenerRemovers) {
            listener.remove();
        }
        this.listenerRemovers = [];
    }

    // ==========================================
    // WEB FALLBACK — getUserMedia + MediaRecorder
    // ==========================================

    private async startWeb() {
        try {
            // Request HD video. Video-only (no audio) for MSE pipeline compatibility—
            // mixed audio+video WebM chunks break Chrome's SourceBuffer sequence mode.
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            this.liveVideoElement.srcObject = this.stream;

            if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
                throw new Error(`Unsupported MIME type: ${MIME_TYPE}`);
            }

            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: MIME_TYPE });
            this.mediaRecorder.ondataavailable = this.handleDataAvailable;
            this.mediaRecorder.start(1000);
            this.isFirstChunk = true;

            // Sync session creation time to the exact MediaRecorder start time.
            await this.db.updateSessionStartTime(this.sessionId, Date.now());
        } catch (error) {
            console.error("Error starting camera:", error);
            alert("Could not start camera. Please ensure you have given permission and are using a supported browser.");
        }
    }

    private handleDataAvailable = async (event: BlobEvent) => {
        if (event.data.size > 0) {
            try {
                if (this.isFirstChunk) {
                    // Save ONLY as init segment (first blob contains WebM header)
                    await this.db.addInitializationSegment(this.sessionId, event.data);
                    this.isFirstChunk = false;
                } else {
                    // All subsequent blobs are pure content chunks
                    await this.db.addChunk(this.sessionId, event.data);

                    const thumbnail = await generateThumbnail(this.liveVideoElement);
                    await this.db.addThumbnail(this.sessionId, thumbnail);
                }
            } catch (error) {
                console.error("Error handling data available:", error);
            }
        }
    };

    private stopWeb() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.liveVideoElement.srcObject = null;
    }
}
