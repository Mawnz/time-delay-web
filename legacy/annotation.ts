export class Annotation {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private isDrawing = false;
    private drawingHistory: { path: { x: number, y: number, type: string }[], color: string, width: number }[] = [];
    private historyPointer: number = -1;
    private currentColor: string = 'red';
    private currentWidth: number = 2;
    public onDrawingEnd: (data: any[]) => void = () => {};

    // FIX B3: ResizeObserver keeps canvas pixels aligned with CSS dimensions
    private resizeObserver: ResizeObserver;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.syncCanvasSize();
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;

        // Observe size changes and resync the canvas coordinate system
        this.resizeObserver = new ResizeObserver(() => {
            this.syncCanvasSize();
            this.redraw();
        });
        this.resizeObserver.observe(canvas);
    }

    /** Keeps canvas pixel buffer in sync with its CSS layout size. */
    private syncCanvasSize() {
        const w = this.canvas.offsetWidth;
        const h = this.canvas.offsetHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            // Restore context styles — they are reset when canvas dimensions change
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentWidth;
        }
    }

    public enableDrawing() {
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.addEventListener('mousedown', this.startDrawing);
        this.canvas.addEventListener('mousemove', this.draw);
        this.canvas.addEventListener('mouseup', this.stopDrawing);
        this.canvas.addEventListener('mouseout', this.stopDrawing);
        this.canvas.addEventListener('touchstart', this.startDrawingTouch, { passive: false });
        this.canvas.addEventListener('touchmove', this.drawTouch, { passive: false });
        this.canvas.addEventListener('touchend', this.stopDrawingTouch, { passive: false });
        this.canvas.addEventListener('touchcancel', this.stopDrawingTouch, { passive: false });
    }

    public disableDrawing() {
        this.canvas.style.pointerEvents = 'none';
        this.canvas.removeEventListener('mousedown', this.startDrawing);
        this.canvas.removeEventListener('mousemove', this.draw);
        this.canvas.removeEventListener('mouseup', this.stopDrawing);
        this.canvas.removeEventListener('mouseout', this.stopDrawing);
        this.canvas.removeEventListener('touchstart', this.startDrawingTouch);
        this.canvas.removeEventListener('touchmove', this.drawTouch);
        this.canvas.removeEventListener('touchend', this.stopDrawingTouch);
        this.canvas.removeEventListener('touchcancel', this.stopDrawingTouch);
    }

    private startDrawing = (e: MouseEvent) => {
        if (this.historyPointer < this.drawingHistory.length - 1) {
            this.drawingHistory = this.drawingHistory.slice(0, this.historyPointer + 1);
        }
        this.historyPointer++;
        this.drawingHistory.push({ path: [], color: this.currentColor, width: this.currentWidth });

        this.isDrawing = true;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
        this.drawingHistory[this.historyPointer].path.push({ x: e.offsetX, y: e.offsetY, type: 'start' });
    }

    private draw = (e: MouseEvent) => {
        if (!this.isDrawing) return;
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();
        this.drawingHistory[this.historyPointer].path.push({ x: e.offsetX, y: e.offsetY, type: 'draw' });
    }

    private stopDrawing = () => {
        if (this.isDrawing) {
            this.ctx.closePath();
            this.isDrawing = false;
            this.onDrawingEnd(this.getDrawingData());
        }
    }

    private startDrawingTouch = (e: TouchEvent) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const offsetX = touch.clientX - rect.left;
        const offsetY = touch.clientY - rect.top;

        if (this.historyPointer < this.drawingHistory.length - 1) {
            this.drawingHistory = this.drawingHistory.slice(0, this.historyPointer + 1);
        }
        this.historyPointer++;
        this.drawingHistory.push({ path: [], color: this.currentColor, width: this.currentWidth });

        this.isDrawing = true;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(offsetX, offsetY);
        this.drawingHistory[this.historyPointer].path.push({ x: offsetX, y: offsetY, type: 'start' });
    }

    private drawTouch = (e: TouchEvent) => {
        e.preventDefault(); // Prevent scrolling
        if (!this.isDrawing) return;
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const offsetX = touch.clientX - rect.left;
        const offsetY = touch.clientY - rect.top;
        this.ctx.lineTo(offsetX, offsetY);
        this.ctx.stroke();
        this.drawingHistory[this.historyPointer].path.push({ x: offsetX, y: offsetY, type: 'draw' });
    }

    private stopDrawingTouch = (e: TouchEvent) => {
        e.preventDefault(); // Prevent scrolling
        if (this.isDrawing) {
            this.ctx.closePath();
            this.isDrawing = false;
            this.onDrawingEnd(this.getDrawingData());
        }
    }

    public setLineColor(color: string) {
        this.currentColor = color;
        this.ctx.strokeStyle = this.currentColor;
    }

    public setLineWidth(width: number) {
        this.currentWidth = width;
        this.ctx.lineWidth = this.currentWidth;
    }

    public undo() {
        if (this.historyPointer > 0) {
            this.historyPointer--;
            this.redraw();
        } else if (this.historyPointer === 0) {
            this.historyPointer--;
            this.clearCanvas();
        }
    }

    public redo() {
        if (this.historyPointer < this.drawingHistory.length - 1) {
            this.historyPointer++;
            this.redraw();
        }
    }

    public clear() {
        this.clearCanvas();
        this.drawingHistory = [];
        this.historyPointer = -1;
    }

    private clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public getDrawingData(): any[] {
        return this.drawingHistory.slice(0, this.historyPointer + 1);
    }

    public loadDrawingData(data: any[]) {
        this.drawingHistory = data;
        this.historyPointer = data.length - 1;
        this.redraw();
    }

    public redraw() {
        this.clearCanvas();
        if (this.historyPointer < 0) return;

        for (let i = 0; i <= this.historyPointer; i++) {
            const drawing = this.drawingHistory[i];
            if (drawing && drawing.path.length > 0) {
                this.ctx.strokeStyle = drawing.color;
                this.ctx.lineWidth = drawing.width;
                this.ctx.beginPath();
                drawing.path.forEach(point => {
                    if (point.type === 'start') {
                        this.ctx.moveTo(point.x, point.y);
                    } else {
                        this.ctx.lineTo(point.x, point.y);
                    }
                });
                this.ctx.stroke();
                this.ctx.closePath();
            }
        }
        // Restore current drawing style
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;
    }

    /** Disconnect the resize observer when this instance is no longer needed. */
    public destroy() {
        this.resizeObserver.disconnect();
    }
}
