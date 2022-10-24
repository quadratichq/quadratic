import { Cell } from './db';

export class gridSpare {
  private cells: Record<string, Cell> = {};
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;

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
    if (!cells) {
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
}