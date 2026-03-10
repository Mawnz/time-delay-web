import { DB } from './db';
import { generateThumbnail } from './thumbnail';
import { MIME_TYPE } from './config';

export class Camera {
    private stream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private isFirstChunk: boolean = true;

    constructor(private liveVideoElement: HTMLVideoElement, private db: DB, private sessionId: string) {}

    async start() {
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
            // This eliminates the camera hardware initialization delay from our timeline timestamps.
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
                    // Save ONLY as init segment. The first MediaRecorder blob contains
                    // the WebM file header (codec init data) but also ~1s of content.
                    // To avoid duplicating this blob in the SourceBuffer (which causes
                    // Chrome sequence mode to stall at buffered=0.934s), we do NOT also
                    // add it as a regular chunk. Content chunks start from blob #2.
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

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.liveVideoElement.srcObject = null;
    }
}
