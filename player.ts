import { DB } from './db';
import { MIME_TYPE } from './config';
import { TimelineManager } from './timeline-manager';

export class Player {
    private mediaSource: MediaSource;
    private sourceBuffer: SourceBuffer | null = null;
    private chunkQueue: ArrayBuffer[] = [];
    private isAppending = false;
    private lastChunkTimestamp = 0;
    private initializationSegmentAppended: boolean = false;
    public userPaused = false;
    public pointA: number | null = null;
    public pointB: number | null = null;
    private _loopEnabled: boolean = false;

    public timelineManager: TimelineManager;

    constructor(private videoElement: HTMLVideoElement, private db: DB, private sessionId: string) {
        this.mediaSource = new MediaSource();
        this.videoElement.src = URL.createObjectURL(this.mediaSource);
        this.mediaSource.addEventListener('sourceopen', () => this.onSourceOpen());
        this.mediaSource.addEventListener('error', (e) => console.error('Video Element Error:', e));
        this.videoElement.addEventListener('timeupdate', () => this.handleTimeUpdate());

        this.timelineManager = new TimelineManager(
            'timeline-wrapper', 
            db, 
            sessionId,
            (seekTime) => {
                if (this.videoElement.seekable.length > 0) {
                    this.userPaused = false;
                    this.videoElement.currentTime = seekTime;
                }
            }
        );

        this.initializationSegmentAppended = false; 
    }

    private onSourceOpen() {
        if (MediaSource.isTypeSupported(MIME_TYPE)) {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(MIME_TYPE);
            this.sourceBuffer.mode = 'sequence';
            this.sourceBuffer.addEventListener('updateend', () => {
                this.isAppending = false;
                this.tryAppendingChunk();
            });
        } else {
            console.error(`Unsupported codec: ${MIME_TYPE}`);
        }
    }

    private async fetchNewChunks() {
        if (!this.sourceBuffer) return;

        if (!this.initializationSegmentAppended) {
            const initSegment = await this.db.getInitializationSegment(this.sessionId);
            if (initSegment) {
                this.initializationSegmentAppended = true;
                const buffer = await initSegment.arrayBuffer();
                this.chunkQueue.push(buffer);
                this.tryAppendingChunk();
            } else {
                return; 
            }
        }

        this.db.getChunksAfter(this.sessionId, this.lastChunkTimestamp, async (chunk, timestamp) => {
            this.lastChunkTimestamp = timestamp;
            const buffer = await chunk.arrayBuffer();
            this.chunkQueue.push(buffer);
            this.tryAppendingChunk();
        });
    }

    private tryAppendingChunk() {
        if (this.sourceBuffer && !this.isAppending && this.chunkQueue.length > 0) {
            this.isAppending = true;
            const buffer = this.chunkQueue.shift()!;
            try {
                this.sourceBuffer.appendBuffer(buffer);
                if (this.videoElement.paused && !this.userPaused) {
                    this.videoElement.play();
                }
            } catch (e) {
                console.error('Error appending buffer:', e);
                this.isAppending = false;
            }
        }
    }

    async start() {
        console.log('Player started');
        
        // NEW: Fetch session start time to sync thumbnails
        const session = await this.db.getSession(this.sessionId);
        if (session) {
            this.timelineManager.setSessionStartTime(session.createdAt);
        }

        this.lastChunkTimestamp = 0;
        this.userPaused = false;
        this.pointA = null;
        this.pointB = null;
        this._loopEnabled = false; 
        
        this.timelineManager.updateRangeHighlight(null, null);

        setInterval(() => this.fetchNewChunks(), 1000);
        
        const updateUI = () => {
            if(this.videoElement) {
                const duration = this.getDuration();
                this.timelineManager.updateDuration(duration);
                this.timelineManager.updateIndicator(this.videoElement.currentTime);
            }
            requestAnimationFrame(updateUI);
        };
        requestAnimationFrame(updateUI);
    }

    private getDuration(): number {
        if (this.videoElement.seekable.length > 0) {
            return this.videoElement.seekable.end(this.videoElement.seekable.length - 1);
        }
        return 0;
    }

    private handleTimeUpdate() {
        if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
            const startPoint = Math.min(this.pointA, this.pointB);
            const endPoint = Math.max(this.pointA, this.pointB);

            if (this.videoElement.currentTime >= endPoint || this.videoElement.currentTime < startPoint) {
                this.videoElement.currentTime = startPoint;
                if (this.videoElement.paused && !this.userPaused) {
                    this.videoElement.play(); 
                }
            }
        }
    }

    // ... (Pass-through methods used by main.ts)
    public get loopEnabled(): boolean { return this._loopEnabled; }
    
    public setPointA(time: number) {
        this.pointA = time;
        this.timelineManager.updateRangeHighlight(this.pointA, this.pointB);
    }

    public setPointB(time: number) {
        this.pointB = time;
        this.timelineManager.updateRangeHighlight(this.pointA, this.pointB);
    }

    public clearPoints() {
        this.pointA = null;
        this.pointB = null;
        this._loopEnabled = false; 
        this.timelineManager.updateRangeHighlight(null, null);
    }

    public setLoop(state: boolean) {
        this._loopEnabled = state;
        if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
            const startPoint = Math.min(this.pointA, this.pointB);
            this.videoElement.currentTime = startPoint;
            this.bringLoopIntoView();
        }
    }

    public toggleLoop() {
        this._loopEnabled = !this._loopEnabled;
        if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
            const startPoint = Math.min(this.pointA, this.pointB);
            this.videoElement.currentTime = startPoint;
            this.bringLoopIntoView();
        }
    }

    private bringLoopIntoView() {
        if (this.pointA === null || this.pointB === null) return;
        
        const startPoint = Math.min(this.pointA, this.pointB);
        const endPoint = Math.max(this.pointA, this.pointB);
        const centerTime = (startPoint + endPoint) / 2;
        
        const centerPixel = this.timelineManager.timeToPixel(centerTime);
        const wrapper = this.timelineManager.getWrapper();
        const halfViewport = wrapper.clientWidth / 2;
        
        wrapper.scrollTo({
            left: centerPixel - halfViewport,
            behavior: 'smooth'
        });
    }

    public async getClipData(start: number, end: number) {
        if (!this.sessionId) throw new Error("No active session.");
        const clipStart = Math.min(start, end);
        const clipEnd = Math.max(start, end);
        
        // Helper to convert video time to DB time
        const session = await this.db.getSession(this.sessionId);
        if(!session) throw new Error("Session not found");
        
        const dbStart = session.createdAt + (clipStart * 1000);
        const dbEnd = session.createdAt + (clipEnd * 1000);

        const [chunks, thumbnails, annotations] = await Promise.all([
            // Note: chunks might need different logic if they strictly use timestamps
            this.db.getChunksBetween(this.sessionId, dbStart, dbEnd),
            this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd),
            this.db.getAnnotationsBetween(this.sessionId, clipStart, clipEnd) // Annotations use Video Time
        ]);

        return { chunks, thumbnails, annotations };
    }

    togglePlayPause() {
        if (this.videoElement.paused) {
            this.userPaused = false;
            this.videoElement.play();
        } else {
            this.userPaused = true;
            this.videoElement.pause();
        }
    }

    toggleSlowMotion() {
        if (this.videoElement.playbackRate === 1.0) {
            this.videoElement.playbackRate = 0.5;
        } else {
            this.videoElement.playbackRate = 1.0;
        }
    }

    frameStep(direction: 'forward' | 'backward') {
        this.userPaused = true;
        this.videoElement.pause();
        const step = 1 / 30;
        if (direction === 'forward') {
            this.videoElement.currentTime += step;
        } else {
            this.videoElement.currentTime -= step;
        }
    }
}