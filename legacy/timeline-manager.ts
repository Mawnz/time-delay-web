import { DB } from './db';

export class TimelineManager {
    private wrapper: HTMLDivElement;
    private spacer: HTMLDivElement;
    private thumbnailsContainer: HTMLDivElement;
    private indicator: HTMLDivElement;
    private rangeHighlight: HTMLDivElement;
    
    // Configuration
    private _zoomLevel: number = 20; // Pixels per second
    private readonly MIN_ZOOM = 1;
    private readonly MAX_ZOOM = 200;
    private readonly MIN_THUMB_WIDTH = 64; // Pixels. We won't render thumbnails smaller than this.
    private bufferSeconds = 5;

    // State
    private totalDuration: number = 0;
    private renderedThumbnails: Map<number, HTMLImageElement> = new Map();
    private sessionStartTime: number = 0;

    // Scroll/interaction guards
    private isUserInteracting = false;         // I3: suppresses auto-scroll while user pans
    private renderDebounceTimer: number | null = null;  // I5: debounce scroll-triggered renders
    private renderGeneration = 0;              // I5: cancel stale async render passes

    constructor(
        wrapperId: string, 
        private db: DB, 
        private sessionId: string,
        private onSeek: (time: number) => void
    ) {
        this.wrapper = document.getElementById(wrapperId) as HTMLDivElement;
        this.spacer = document.getElementById('timeline-spacer') as HTMLDivElement;
        this.thumbnailsContainer = document.getElementById('thumbnails-container') as HTMLDivElement;
        this.indicator = document.getElementById('timeline-indicator') as HTMLDivElement;
        this.rangeHighlight = document.getElementById('timeline-range-highlight') as HTMLDivElement;

        this.setupEventListeners();
        this.updateLayout();
    }

    public setSessionStartTime(startTime: number) {
        this.sessionStartTime = startTime;
        this.renderedThumbnails.clear(); 
        this.thumbnailsContainer.innerHTML = '';
        this.renderVisibleThumbnails();
    }

    private setupEventListeners() {
        // I3: Track when user is actively interacting so auto-scroll is suppressed
        const setInteracting = (v: boolean) => { this.isUserInteracting = v; };
        this.wrapper.addEventListener('mousedown', () => setInteracting(true));
        this.wrapper.addEventListener('touchstart', () => setInteracting(true), { passive: true });
        window.addEventListener('mouseup', () => setInteracting(false));
        window.addEventListener('touchend', () => setInteracting(false));

        this.wrapper.addEventListener('scroll', () => {
            // I5: Debounce — only trigger a render after scrolling settles (80ms)
            if (this.renderDebounceTimer !== null) clearTimeout(this.renderDebounceTimer);
            this.renderDebounceTimer = window.setTimeout(() => {
                this.renderDebounceTimer = null;
                this.renderVisibleThumbnails();
            }, 80);
        }, { passive: true });

        this.wrapper.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
            const rect = this.wrapper.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const time = this.pixelToTime(this.wrapper.scrollLeft + clickX);
            this.onSeek(Math.max(0, Math.min(time, this.totalDuration)));
        });

        this.wrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                this.handleZoom(e.deltaY, e.clientX);
            }
        }, { passive: false });
    }

    public updateDuration(duration: number) {
        const safeDuration = Math.max(duration, 1); 
        if (Math.abs(this.totalDuration - safeDuration) > 0.1) {
            this.totalDuration = safeDuration;
            this.updateLayout();
        }
    }

    public updateIndicator(currentTime: number) {
        const pos = this.timeToPixel(currentTime);
        this.indicator.style.transform = `translateX(${pos}px)`;

        const visibleStart = this.wrapper.scrollLeft;
        const visibleEnd = visibleStart + this.wrapper.clientWidth;

        // I3: Only auto-scroll when user is not actively interacting with the timeline
        if (!this.isUserInteracting && pos > visibleEnd - 50) {
            this.wrapper.scrollLeft = pos - (this.wrapper.clientWidth * 0.2);
        }
    }

    public updateRangeHighlight(start: number | null, end: number | null) {
        if (start === null || end === null) {
            this.rangeHighlight.style.display = 'none';
            return;
        }
        const startPx = this.timeToPixel(Math.min(start, end));
        const endPx = this.timeToPixel(Math.max(start, end));
        const width = endPx - startPx;
        
        this.rangeHighlight.style.display = 'block';
        this.rangeHighlight.style.transform = `translateX(${startPx}px)`;
        this.rangeHighlight.style.width = `${width}px`;
    }

    private updateLayout() {
        const totalWidth = this.totalDuration * this._zoomLevel;
        this.spacer.style.width = `${Math.max(totalWidth, this.wrapper.clientWidth)}px`;
        this.renderVisibleThumbnails();
    }

    private handleZoom(delta: number, mouseX: number) {
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, this._zoomLevel * zoomFactor));
        if (newZoom === this._zoomLevel) return;

        const rect = this.wrapper.getBoundingClientRect();
        const mouseOffset = mouseX - rect.left;
        const timeUnderCursor = this.pixelToTime(this.wrapper.scrollLeft + mouseOffset);

        this._zoomLevel = newZoom;
        this.updateLayout();

        const newScrollLeft = this.timeToPixel(timeUnderCursor) - mouseOffset;
        this.wrapper.scrollLeft = newScrollLeft;
    }

    private async renderVisibleThumbnails() {
        if (!this.sessionId || this.sessionStartTime === 0) return;

        // I5: Increment generation. If this render becomes stale (a new one starts), bail out.
        const generation = ++this.renderGeneration;

        // 1. Calculate the "Stride"
        const rawStride = this.MIN_THUMB_WIDTH / this._zoomLevel;
        const stride = Math.max(1, Math.ceil(rawStride));

        const visibleStartPx = this.wrapper.scrollLeft;
        const visibleEndPx = visibleStartPx + this.wrapper.clientWidth;

        const startTimeRel = Math.max(0, this.pixelToTime(visibleStartPx) - (this.bufferSeconds * stride));
        const endTimeRel = this.pixelToTime(visibleEndPx) + (this.bufferSeconds * stride);

        // 2. Align start time to stride boundary
        const startAligned = Math.floor(startTimeRel / stride) * stride;

        const dbStart = this.sessionStartTime + (startAligned * 1000);
        const dbEnd = this.sessionStartTime + (endTimeRel * 1000);

        // Fetch range of thumbnails.
        const thumbs = await this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd);

        const validTimestamps = new Set<number>();
        const chosenThumbs: Array<{ ts: number, data: string, relativeTime: number, pixelPos: number }> = [];

        // 1. Filter out thumbnails and pick ones that satisfy MIN_THUMB_WIDTH distance
        let lastPixel = -Infinity;
        thumbs.forEach(t => {
            const relativeTime = (t.timestamp - this.sessionStartTime) / 1000;
            // Cap to total duration so we don't draw thumbnails from the delay buffer
            if (relativeTime > this.totalDuration) return;

            const pixelPos = this.timeToPixel(relativeTime);

            if (pixelPos - lastPixel >= this.MIN_THUMB_WIDTH) {
                // For native, we have t.filePath. For web, t.data is a base64 or object URL.
                // Depending on the DB contents, we adapt:
                let srcUrl = '';
                if (t.filePath) {
                    // Requires '@capacitor/core' Capacitor object
                    srcUrl = (window as any).Capacitor.convertFileSrc(t.filePath);
                } else if (t.data) {
                    srcUrl = t.data;
                }

                chosenThumbs.push({ ts: t.timestamp, data: srcUrl, relativeTime, pixelPos });
                lastPixel = pixelPos;
            }
        });

        // 2. Render and dynamically stretch widths to form a perfect contiguous timeline
        for (let i = 0; i < chosenThumbs.length; i++) {
            const current = chosenThumbs[i];
            const next = chosenThumbs[i + 1];

            validTimestamps.add(current.ts);

            let widthPx = this.MIN_THUMB_WIDTH;
            if (next) {
                widthPx = next.pixelPos - current.pixelPos;
            } else {
                // The last thumbnail stretches to the end of the total duration
                const endPixel = this.timeToPixel(this.totalDuration);
                widthPx = Math.max(this.MIN_THUMB_WIDTH, endPixel - current.pixelPos);
            }

            if (!this.renderedThumbnails.has(current.ts)) {
                const img = document.createElement('img');
                img.src = current.data;
                img.className = 'timeline-thumbnail';

                img.style.transform = `translateX(${current.pixelPos}px)`;
                img.style.width = `${widthPx}px`;

                this.thumbnailsContainer.appendChild(img);
                this.renderedThumbnails.set(current.ts, img);
            } else {
                const img = this.renderedThumbnails.get(current.ts)!;
                img.style.transform = `translateX(${current.pixelPos}px)`;
                img.style.width = `${widthPx}px`;
            }
        }

        // 3. Cleanup off-screen or stale thumbnails
        for (const [ts, img] of this.renderedThumbnails) {
            if (!validTimestamps.has(ts)) {
                img.remove();
                this.renderedThumbnails.delete(ts);
            }
        }
    }

    public timeToPixel(time: number): number {
        return time * this._zoomLevel;
    }

    public pixelToTime(pixel: number): number {
        return pixel / this._zoomLevel;
    }

    public getZoomLevel() { return this._zoomLevel; }
    public getWrapper() { return this.wrapper; }
}