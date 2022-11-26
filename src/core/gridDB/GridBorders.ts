import { Rectangle } from 'pixi.js';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Border } from './db';

export class GridBorders {
  private app: PixiApp;
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  borders = new Map<string, Border>();

  constructor(app: PixiApp) {
    this.app = app;
  }

  empty() {
    this.borders.clear();
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(borders?: Border[]) {
    if (!borders?.length) {
      this.empty();
      return;
    }
    this.borders.clear();
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    borders?.forEach((border) => {
      this.borders.set(this.getKey(border.x, border.y), border);
      this.minX = Math.min(this.minX, border.x);
      this.maxX = Math.max(this.maxX, border.x);
      this.minY = Math.min(this.minY, border.y);
      this.maxY = Math.max(this.maxY, border.y);
    });
  }

  get(x: number, y: number): Border | undefined {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    return this.borders.get(this.getKey(x, y));
  }

  getBounds(bounds: Rectangle): Rectangle {
    const columnStartIndex = this.app.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > this.minX ? columnStartIndex.index : this.minX;
    const columnEndIndex = this.app.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < this.maxX ? columnEndIndex.index : this.maxX;

    const rowStartIndex = this.app.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > this.minY ? rowStartIndex.index : this.minY;
    const rowEndIndex = this.app.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < this.maxY ? rowEndIndex.index : this.maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }

  getGridBounds(): Rectangle {
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }
}
