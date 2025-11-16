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
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.liveVideoElement.srcObject = this.stream;

            if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
                throw new Error(`Unsupported MIME type: ${MIME_TYPE}`);
            }

            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: MIME_TYPE });
            this.mediaRecorder.ondataavailable = this.handleDataAvailable;
            this.mediaRecorder.start(1000);
            this.isFirstChunk = true; // Reset for new recording
        } catch (error) {
            console.error("Error starting camera:", error);
            alert("Could not start camera. Please ensure you have given permission and are using a supported browser.");
        }
    }

    private handleDataAvailable = async (event: BlobEvent) => {
        if (event.data.size > 0) {
            try {
                if (this.isFirstChunk) {
                    await this.db.addInitializationSegment(this.sessionId, event.data);
                    this.isFirstChunk = false;
                }
                // Always add the data as a regular chunk
                await this.db.addChunk(this.sessionId, event.data);
                
                const thumbnail = await generateThumbnail(this.liveVideoElement);
                await this.db.addThumbnail(this.sessionId, thumbnail);
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
