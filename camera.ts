import { DB } from './db';
import { generateThumbnail } from './thumbnail';

export class Camera {
    private stream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private isFirstChunk: boolean = true;

    constructor(private liveVideoElement: HTMLVideoElement, private db: DB, private sessionId: string) {}

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.liveVideoElement.srcObject = this.stream;
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'video/webm; codecs="vp8"' });
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                console.log('Chunk size:', event.data.size);
                if (this.isFirstChunk) {
                    await this.db.addInitializationSegment(this.sessionId, event.data);
                    this.isFirstChunk = false;
                } else {
                    this.db.addChunk(this.sessionId, event.data);
                }
                const thumbnail = await generateThumbnail(this.liveVideoElement);
                this.db.addThumbnail(this.sessionId, thumbnail);
            }
        };
        this.mediaRecorder.start(1000);
        this.isFirstChunk = true; // Reset for new recording
    }

    stop() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.liveVideoElement.srcObject = null;
    }
}
