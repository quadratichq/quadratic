import { Matrix, RenderTexture } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';
import { CellAndFormatAndPosition } from './Quadrant';
import { MAX_TEXTURE_SIZE } from './quadrantConstants';

export class SubQuadrant {
  private app: PixiApp;
  private cells: CellAndFormatAndPosition[] = [];
  private texture?: RenderTexture;

  private left: number;
  private right: number;
  private top: number;
  private bottom: number;

  constructor(app: PixiApp, left: number, right: number, top: number, bottom: number) {
    this.app = app;
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
  }

  clear() {
    this.cells = [];
  }

  overlaps(left: number, top: number, right: number, bottom: number): boolean {
    return this.left < right && this.right > left && this.top < bottom && this.bottom > top;
  }

  add(cell: CellAndFormatAndPosition): void {
    this.cells.push(cell);
  }

  update() {
    // this.app.cells.drawSubQuadrant(this.cells);
    this.texture = this.texture ?? RenderTexture.create({
      width: MAX_TEXTURE_SIZE,
      height: MAX_TEXTURE_SIZE,
    });
    const transform = new Matrix();
    transform.translate(-this.left, -this.top);
    this.app.renderer.render(this.app.cells, { renderTexture: this.texture, transform });
  }

  // this adds cells that potentially overlap the subQuadrant
  // addOverlap
}