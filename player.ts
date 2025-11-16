import { DB } from './db';
import { MIME_TYPE } from './config';

export class Player {
    private mediaSource: MediaSource;
    private sourceBuffer: SourceBuffer | null = null;
    private chunkQueue: ArrayBuffer[] = [];
    private isAppending = false;
    private lastChunkTimestamp = 0;
    private initializationSegmentAppended: boolean = false;
    private lastThumbnailTimestamp = 0;
    private userPaused = false;
    private pointA: number | null = null;
    private pointB: number | null = null;
    private loopEnabled: boolean = false;

    private thumbnailTimeline: HTMLDivElement;
    private timelineIndicator: HTMLDivElement;
    private timelineRangeHighlight: HTMLDivElement;
    
        constructor(private videoElement: HTMLVideoElement, private db: DB, private sessionId: string) {
            this.mediaSource = new MediaSource();
            this.videoElement.src = URL.createObjectURL(this.mediaSource);
            this.mediaSource.addEventListener('sourceopen', () => this.onSourceOpen());
            this.mediaSource.addEventListener('sourceended', () => console.log('MediaSource ended'));
            this.mediaSource.addEventListener('sourceclose', () => console.log('MediaSource closed'));
            this.videoElement.addEventListener('error', (e) => console.error('Video Element Error:', e));
            this.videoElement.addEventListener('stalled', (e) => console.log('Video Element Stalled:', e));
            this.videoElement.addEventListener('timeupdate', () => this.handleTimeUpdate());

            this.thumbnailTimeline = document.getElementById('thumbnail-timeline') as HTMLDivElement;
            this.timelineIndicator = document.getElementById('timeline-indicator') as HTMLDivElement;
            this.timelineRangeHighlight = document.getElementById('timeline-range-highlight') as HTMLDivElement;
            this.thumbnailTimeline.addEventListener('click', (e) => this.handleTimelineSeek(e));
            this.thumbnailTimeline.addEventListener('touchmove', (e) => {
                e.preventDefault(); // Prevent scrolling while seeking
                this.handleTimelineSeek(e.touches[0])
            });

            this.initializationSegmentAppended = false; // Reset for new player instance
        }
    private onSourceOpen() {
        console.log('Source open');
        if (MediaSource.isTypeSupported(MIME_TYPE)) {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(MIME_TYPE);
            this.sourceBuffer.mode = 'sequence';
            this.sourceBuffer.addEventListener('updateend', () => {
                this.isAppending = false;
                // After any append, try to append the next chunk in the queue
                this.tryAppendingChunk();
            });
            this.sourceBuffer.addEventListener('error', (e) => console.error('SourceBuffer Error:', e));
            this.sourceBuffer.addEventListener('abort', (e) => console.log('SourceBuffer Abort:', e));
        } else {
            console.error(`Unsupported codec: ${MIME_TYPE}`);
        }
    }

    private async fetchNewChunks() {
        if (!this.sourceBuffer) return;

        if (!this.initializationSegmentAppended) {
            console.log('Polling for init segment...');
            const initSegment = await this.db.getInitializationSegment(this.sessionId);
            if (initSegment) {
                console.log('Found init segment.');
                this.initializationSegmentAppended = true;
                const buffer = await initSegment.arrayBuffer();
                this.chunkQueue.push(buffer);
                this.tryAppendingChunk();
            } else {
                return; // If still no init segment, wait for next tick.
            }
        }

        // Now, fetch media chunks.
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
                // Only auto-play if the user hasn't explicitly paused
                if (this.videoElement.paused && !this.userPaused) {
                    this.videoElement.play();
                }
            } catch (e) {
                console.error('Error appending buffer:', e);
                this.isAppending = false;
            }
        }
    }

    private fetchThumbnails() {
        this.db.getThumbnailsAfter(this.sessionId, this.lastThumbnailTimestamp, (thumbnail, timestamp) => {
            this.lastThumbnailTimestamp = timestamp;
            const img = document.createElement('img');
            img.src = thumbnail;
            img.dataset.timestamp = timestamp.toString();
            img.className = 'inline-block h-full w-auto mr-1';
            this.thumbnailTimeline.appendChild(img);
        });
    }

    start() {
        console.log('Player started');
        this.lastChunkTimestamp = 0;
        this.lastThumbnailTimestamp = 0;
        this.userPaused = false;
        this.pointA = null;
        this.pointB = null;
        this.loopEnabled = false; // Reset loop state
        this.updateTimelineRangeHighlight(); // Clear any previous highlight
        setInterval(() => this.fetchNewChunks(), 1000);
        setInterval(() => this.fetchThumbnails(), 1000);
        setInterval(() => this.updateTimelineIndicator(), 100);
    }

    private handleTimeUpdate() {
        if (this.loopEnabled && this.pointA !== null && this.pointB !== null) {
            const startPoint = Math.min(this.pointA, this.pointB);
            const endPoint = Math.max(this.pointA, this.pointB);

            if (this.videoElement.currentTime >= endPoint) {
                this.videoElement.currentTime = startPoint;
                if (this.videoElement.paused && !this.userPaused) {
                    this.videoElement.play(); // Auto-play if not user-paused
                }
            }
        }
    }

    private updateTimelineIndicator() {
        if (this.videoElement.seekable.length === 0) return;
        const seekableEnd = this.videoElement.seekable.end(this.videoElement.seekable.length - 1);
        if (!isFinite(seekableEnd) || seekableEnd === 0) return;

        const percentage = this.videoElement.currentTime / seekableEnd;
        const indicatorPosition = percentage * this.thumbnailTimeline.scrollWidth;
        this.timelineIndicator.style.left = `${indicatorPosition}px`;

        // If video is playing, keep the indicator in view
        if (!this.videoElement.paused) {
            this.timelineIndicator.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        this.updateTimelineRangeHighlight();
    }

    private updateTimelineRangeHighlight() {
        if (this.pointA === null || this.pointB === null || this.videoElement.seekable.length === 0) {
            this.timelineRangeHighlight.style.display = 'none';
            return;
        }

        const seekableEnd = this.videoElement.seekable.end(this.videoElement.seekable.length - 1);
        if (!isFinite(seekableEnd) || seekableEnd === 0) return;

        const startPoint = Math.min(this.pointA, this.pointB);
        const endPoint = Math.max(this.pointA, this.pointB);

        const startPercentage = startPoint / seekableEnd;
        const endPercentage = endPoint / seekableEnd;

        const timelineWidth = this.thumbnailTimeline.scrollWidth;

        this.timelineRangeHighlight.style.left = `${startPercentage * timelineWidth}px`;
        this.timelineRangeHighlight.style.width = `${(endPercentage - startPercentage) * timelineWidth}px`;
        this.timelineRangeHighlight.style.display = 'block';
    }

    public setPointA(time: number) {
        this.pointA = time;
        this.updateTimelineRangeHighlight();
    }

    public setPointB(time: number) {
        this.pointB = time;
        this.updateTimelineRangeHighlight();
    }

    public clearPoints() {
        this.pointA = null;
        this.pointB = null;
        this.updateTimelineRangeHighlight();
    }

    public toggleLoop() {
        this.loopEnabled = !this.loopEnabled;
        console.log('Loop enabled:', this.loopEnabled);
    }

    public async getClipData(start: number, end: number) {
        if (!this.sessionId) throw new Error("No active session to export clip from.");
        if (start === null || end === null) throw new Error("A/B points must be set to export a clip.");

        const clipStart = Math.min(start, end);
        const clipEnd = Math.max(start, end);

        const [chunks, thumbnails, annotations] = await Promise.all([
            this.db.getChunksBetween(this.sessionId, clipStart, clipEnd),
            this.db.getThumbnailsBetween(this.sessionId, clipStart, clipEnd),
            this.db.getAnnotationsBetween(this.sessionId, clipStart, clipEnd)
        ]);

        return { chunks, thumbnails, annotations };
    }

    private handleTimelineSeek(event: MouseEvent | Touch) {
        if (this.videoElement.seekable.length === 0) return;

        const seekableEnd = this.videoElement.seekable.end(this.videoElement.seekable.length - 1);
        if (!isFinite(seekableEnd)) return;
    
        const timelineRect = this.thumbnailTimeline.getBoundingClientRect();
        const clickX = event.clientX - timelineRect.left;
        const scrollX = this.thumbnailTimeline.scrollLeft;
        const scrollWidth = this.thumbnailTimeline.scrollWidth;
    
        // Prevent division by zero if scrollWidth is not yet set
        if (scrollWidth === 0) return;

        const seekPercentage = (clickX + scrollX) / scrollWidth;
        const seekTime = seekableEnd * seekPercentage;
    
        if (isFinite(seekTime)) {
            this.userPaused = false; // Assume user wants to play after seeking
            this.videoElement.currentTime = seekTime;
        }
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
        const frameRate = 30; // Assuming 30fps
        const step = 1 / frameRate;
        if (direction === 'forward') {
            this.videoElement.currentTime += step;
        } else {
            this.videoElement.currentTime -= step;
        }
    }
}