import { Rectangle } from 'pixi.js';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Cell } from './db';

export class gridSpare {
  private app: PixiApp;
  private cells: Record<string, Cell> = {};
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;

  constructor(app: PixiApp) {
    this.app = app;
  }

  empty() {
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  populate(cells?: Cell[]) {
    this.cells = {};
    if (!cells?.length) {
      this.empty();
      return;
    }
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    cells.forEach(cell => {
      this.cells[this.getKey(cell.x, cell.y)] = cell;
      this.minX = Math.min(this.minX, cell.x);
      this.maxX = Math.max(this.maxX, cell.x);
      this.minY = Math.min(this.minY, cell.y);
      this.maxY = Math.max(this.maxY, cell.y);
    });
  }

  get(x: number, y: number): Cell | undefined {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    return this.cells[this.getKey(x, y)];
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
}