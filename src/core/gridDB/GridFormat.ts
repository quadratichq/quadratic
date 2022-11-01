import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { CellFormat } from './db';

export class GridFormat {
  private app: PixiApp;
  private cells: Record<string, CellFormat> = {};
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

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(cells?: CellFormat[]) {
    this.cells = {};
    if (!cells?.length) {
      this.empty();
      return;
    }
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    cells.forEach((cell) => {
      this.cells[this.getKey(cell.x, cell.y)] = cell;
      this.minX = cell.x !== undefined ? Math.min(this.minX, cell.x) : this.minX;
      this.maxX = cell.x !== undefined ? Math.max(this.maxX, cell.x) : this.maxX;
      this.minY = cell.y !== undefined ? Math.min(this.minY, cell.y) : this.minY;
      this.maxY = cell.y !== undefined ? Math.max(this.maxY, cell.y) : this.maxY;
    });
    this.app.cells.dirty = true;
  }

  get(x?: number, y?: number): CellFormat | undefined {
    if (x !== undefined && y !== undefined && (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY)) return;
    return this.cells[this.getKey(x, y)];
  }
}