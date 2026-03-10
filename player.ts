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
    private _delaySeconds: number = 5;
    private sessionStartTime: number = 0;

    // Lifecycle handles — stored so they can be cancelled in destroy()
    private fetchIntervalId: number | null = null;
    private rafId: number | null = null;
    private blobUrl: string | null = null;
    private isDestroyed = false;

    public timelineManager: TimelineManager;

    constructor(private videoElement: HTMLVideoElement, private db: DB, private sessionId: string) {
        this.mediaSource = new MediaSource();
        this.blobUrl = URL.createObjectURL(this.mediaSource);
        this.videoElement.src = this.blobUrl;
        this.mediaSource.addEventListener('sourceopen', () => this.onSourceOpen());
        this.mediaSource.addEventListener('error', (e) => console.error('MediaSource Error:', e));
        this.videoElement.addEventListener('timeupdate', () => this.handleTimeUpdate());

        this.timelineManager = new TimelineManager(
            'timeline-wrapper',
            db,
            sessionId,
            (seekTime) => {
                this.seekTo(seekTime);
            }
        );

        this.initializationSegmentAppended = false;
    }

    private onSourceOpen() {
        if (this.isDestroyed) return;
        if (MediaSource.isTypeSupported(MIME_TYPE)) {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(MIME_TYPE);
            // sequence mode: browser automatically sequences appended WebM chunks
            // contiguously on the timeline. Works correctly with video-only vp8 streams
            // from MediaRecorder. Do NOT add audio tracks to this pipeline— mixed
            // audio+video WebM chunks break timestamp handling in Chrome's MSE.
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
        if (this.isDestroyed || !this.sourceBuffer) return;

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

        if (this.isDestroyed) return;

        // Only fetch chunks that are old enough to satisfy the delay threshold.
        // The chunk timestamp marks the END of the chunk (approx 1000ms long).
        // By adding 1500ms to the threshold, we append chunks whose START satisfies the delay,
        // giving the browser 500ms+ of buffer ahead of the playhead to stop playback stalls.
        const delayThreshold = Date.now() - (this._delaySeconds * 1000) + 1500;

        this.db.getChunksAfter(this.sessionId, this.lastChunkTimestamp, async (chunk, timestamp) => {
            if (this.isDestroyed) return;
            if (timestamp > delayThreshold) return; // too recent — skip
            this.lastChunkTimestamp = timestamp;
            const buffer = await chunk.arrayBuffer();
            this.chunkQueue.push(buffer);
            this.tryAppendingChunk();
        });
    }

    private tryAppendingChunk() {
        if (this.isDestroyed) return;
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

        const session = await this.db.getSession(this.sessionId);
        if (session) {
            this.sessionStartTime = session.createdAt;
            this.timelineManager.setSessionStartTime(session.createdAt);
        }

        this.lastChunkTimestamp = 0;
        this.videoElement.pause();
        this.userPaused = false;
        this.pointA = null;
        this.pointB = null;
        this._loopEnabled = false;

        this.timelineManager.updateRangeHighlight(null, null);

        this.fetchIntervalId = window.setInterval(() => this.fetchNewChunks(), 1000);
        this.fetchNewChunks(); // Fetch immediately, don't wait 1000ms

        const updateUI = () => {
            if (this.isDestroyed) return;
            if (this.videoElement) {
                // Resume autoplay ONLY once the real-world time offset exceeds the delay
                if (!this.userPaused && this.videoElement.paused && this.sessionStartTime > 0) {
                    const elapsed = Date.now() - this.sessionStartTime;
                    if (elapsed >= (this._delaySeconds * 1000)) {
                        this.videoElement.play().catch(e => console.warn('Play error:', e));
                    }
                }

                const duration = this.getDuration();
                this.timelineManager.updateDuration(duration);
                this.timelineManager.updateIndicator(this.videoElement.currentTime);
            }
            this.rafId = requestAnimationFrame(updateUI);
        };
        this.rafId = requestAnimationFrame(updateUI);
    }

    /**
     * Cleanly tears down this Player instance:
     * - Stops the fetch interval
     * - Cancels the rAF loop
     * - Revokes the MediaSource blob URL
     */
    public destroy() {
        this.isDestroyed = true;

        if (this.fetchIntervalId !== null) {
            clearInterval(this.fetchIntervalId);
            this.fetchIntervalId = null;
        }

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Detach the video source before revoking so the browser releases the MediaSource
        this.videoElement.removeAttribute('src');
        this.videoElement.load();

        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }

        try {
            if (this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
        } catch (_) { /* already closed */ }

        this.chunkQueue = [];
        this.sourceBuffer = null;
        console.log('Player destroyed.');
    }

    private getDuration(): number {
        // True playable duration aligns perfectly with wall-clock time offset by the delay buffer.
        // Relying on videoElement.seekable is volatile because chunks buffer in real-time.
        if (!this.sessionStartTime) return 0;
        const realElapsed = (Date.now() - this.sessionStartTime) / 1000;
        return Math.max(0, realElapsed - this._delaySeconds);
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

        const session = await this.db.getSession(this.sessionId);
        if (!session) throw new Error("Session not found");

        const dbStart = session.createdAt + ((Math.max(0, clipStart - 2)) * 1000);
        const dbEnd = session.createdAt + ((clipEnd + 2) * 1000);

        const [chunks, thumbnails, annotations] = await Promise.all([
            this.db.getChunksBetween(this.sessionId, dbStart, dbEnd),
            this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd),
            this.db.getAnnotationsBetween(this.sessionId, clipStart, clipEnd)
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

    get isSlowMotion(): boolean {
        return this.videoElement.playbackRate !== 1.0;
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

    // --- Configurable Delay ---

    public setDelay(seconds: number) {
        this._delaySeconds = Math.max(1, seconds);
    }

    public get delaySeconds(): number {
        return this._delaySeconds;
    }

    // --- Out-of-Buffer Seeking ---

    /**
     * Seeks to the given video time. If the time is within the current buffered
     * range, simply sets currentTime. Otherwise, clears the SourceBuffer,
     * re-appends the init segment, fetches chunks from the seek target, and
     * resumes playback.
     */
    public async seekTo(timeSeconds: number) {
        if (this.isDestroyed || !this.sourceBuffer) return;
        this.userPaused = false;

        // Simple case: time is already buffered
        const buffered = this.videoElement.buffered;
        for (let i = 0; i < buffered.length; i++) {
            if (timeSeconds >= buffered.start(i) && timeSeconds <= buffered.end(i)) {
                this.videoElement.currentTime = timeSeconds;
                if (this.videoElement.paused) this.videoElement.play();
                return;
            }
        }

        // Out-of-buffer seek: rebuild the SourceBuffer from scratch
        try {
            // 1. Abort any in-progress append
            if (this.sourceBuffer.updating) {
                this.sourceBuffer.abort();
            }

            // 2. Remove all buffered content
            if (this.sourceBuffer.buffered.length > 0) {
                this.sourceBuffer.remove(0, Infinity);
                await this.waitForUpdateEnd();
            }

            // 3. Re-append init segment at 0 so it doesn't play if we're seeking to 60s
            this.sourceBuffer.timestampOffset = 0;
            const initSegment = await this.db.getInitializationSegment(this.sessionId);
            if (!initSegment) return;
            this.sourceBuffer.appendBuffer(await initSegment.arrayBuffer());
            await this.waitForUpdateEnd();

            // 4. Sequence mode packs chunks contiguously. We MUST set timestampOffset
            // so the next content chunk begins exactly at our desired seek target.
            this.sourceBuffer.timestampOffset = timeSeconds;

            // 5. Calculate DB timestamp from video time and fetch chunks
            const dbTimestamp = this.sessionStartTime + (timeSeconds * 1000);
            const delayThreshold = Date.now() - (this._delaySeconds * 1000);

            // Clear the queue so old pending chunks don't interfere
            this.chunkQueue = [];

            // Update lastChunkTimestamp so the periodic fetch continues from here
            this.lastChunkTimestamp = dbTimestamp;

            this.db.getChunksAfter(this.sessionId, dbTimestamp, async (chunk, timestamp) => {
                if (this.isDestroyed || !this.sourceBuffer) return;
                if (timestamp > delayThreshold) return;
                this.lastChunkTimestamp = timestamp;
                const buffer = await chunk.arrayBuffer();
                this.chunkQueue.push(buffer);
                this.tryAppendingChunk();
            });

            // 5. Set currentTime after a small delay to let chunks append
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.videoElement.currentTime = timeSeconds;
                    if (this.videoElement.paused && !this.userPaused) {
                        this.videoElement.play();
                    }
                }
            }, 200);
        } catch (e) {
            console.error('Seek failed:', e);
        }
    }

    private waitForUpdateEnd(): Promise<void> {
        return new Promise(resolve => {
            if (!this.sourceBuffer) return resolve();
            if (!this.sourceBuffer.updating) return resolve();
            this.sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
        });
    }
}