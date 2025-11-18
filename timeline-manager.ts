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
        this.wrapper.addEventListener('scroll', () => {
            this.renderVisibleThumbnails();
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
        
        // Auto-scroll logic
        if (pos > visibleEnd - 50) { 
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

        // 1. Calculate the "Stride"
        // Stride is how many seconds one thumbnail represents.
        // If 1 second is 10px (zoomLevel), and min width is 64px, we need roughly 7 seconds per thumbnail.
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

        // 3. Cleanup off-screen thumbnails
        for (const [ts, img] of this.renderedThumbnails) {
            if (ts < dbStart || ts > dbEnd) {
                img.remove();
                this.renderedThumbnails.delete(ts);
            }
        }

        // 4. Fetch range of thumbnails.
        // NOTE: DB returns ALL thumbnails in range. We must filter locally for the stride.
        // Ideally, DB would support skipping, but IDB is basic.
        const thumbs = await this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd);
        
        thumbs.forEach(t => {
            const relativeTime = (t.timestamp - this.sessionStartTime) / 1000;
            
            // Filter: Only show if this timestamp falls near a stride boundary
            // We allow a small jitter (0.2s) because timers aren't perfect
            const strideIndex = Math.round(relativeTime / stride);
            const expectedTime = strideIndex * stride;
            
            if (Math.abs(relativeTime - expectedTime) < 0.5) {
                if (!this.renderedThumbnails.has(t.timestamp)) {
                    const img = document.createElement('img');
                    img.src = t.data;
                    img.className = 'absolute top-0 h-full object-cover select-none pointer-events-none border-r border-gray-800/50';
                    
                    const leftPos = this.timeToPixel(relativeTime);
                    
                    // STRETCH LOGIC: The width corresponds to the stride duration
                    const width = stride * this._zoomLevel; 
                    
                    img.style.transform = `translateX(${leftPos}px)`;
                    img.style.width = `${width}px`;

                    this.thumbnailsContainer.appendChild(img);
                    this.renderedThumbnails.set(t.timestamp, img);
                } else {
                    // Update width/position of existing (in case zoom changed)
                    const img = this.renderedThumbnails.get(t.timestamp)!;
                    const leftPos = this.timeToPixel(relativeTime);
                    const width = stride * this._zoomLevel;
                    img.style.transform = `translateX(${leftPos}px)`;
                    img.style.width = `${width}px`;
                }
            }
        });
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