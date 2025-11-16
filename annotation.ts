export class Annotation {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private isDrawing = false;
    private drawingData: any[] = [];
    public onDrawingEnd: (data: any[]) => void = () => {};

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 2;
    }

    public enableDrawing() {
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.addEventListener('mousedown', this.startDrawing);
        this.canvas.addEventListener('mousemove', this.draw);
        this.canvas.addEventListener('mouseup', this.stopDrawing);
        this.canvas.addEventListener('mouseout', this.stopDrawing);
    }

    public disableDrawing() {
        this.canvas.style.pointerEvents = 'none';
        this.canvas.removeEventListener('mousedown', this.startDrawing);
        this.canvas.removeEventListener('mousemove', this.draw);
        this.canvas.removeEventListener('mouseup', this.stopDrawing);
        this.canvas.removeEventListener('mouseout', this.stopDrawing);
    }

    private startDrawing = (e: MouseEvent) => {
        this.clear();
        this.isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
        this.drawingData.push({ x: e.offsetX, y: e.offsetY, type: 'start' });
    }

    private draw = (e: MouseEvent) => {
        if (!this.isDrawing) return;
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();
        this.drawingData.push({ x: e.offsetX, y: e.offsetY, type: 'draw' });
    }

    private stopDrawing = () => {
        if (this.isDrawing) {
            this.ctx.closePath();
            this.isDrawing = false;
            this.onDrawingEnd(this.drawingData);
        }
    }

    public clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawingData = [];
    }

    public getDrawingData(): any[] {
        return this.drawingData;
    }

    public loadDrawingData(data: any[]) {
        this.clear();
        this.drawingData = data;
        this.redraw();
    }

    public redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.drawingData.length === 0) return;

        this.ctx.beginPath();
        this.drawingData.forEach(point => {
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
