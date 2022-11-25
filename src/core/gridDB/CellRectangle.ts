import { Rectangle } from 'pixi.js';
import { CellAndFormat, GridSparse } from './GridSparse';

export class CellRectangle {
  private cells: (CellAndFormat | undefined)[];
  private size: Rectangle;

  // todo: the GridSparse call will be replaced by the rust controller call
  constructor(size: Rectangle, grid: GridSparse) {
    const cells: (CellAndFormat | undefined)[] = [];
    this.size = size;
    for (let y = size.top; y <= size.bottom; y++) {
      for (let x = size.left; x <= size.right; x++) {
        cells[y * (size.width + 1) + x] = grid.get(x, y);
      }
    }
    this.cells = cells;
  }

  get(x: number, y: number): CellAndFormat | undefined {
    return this.cells[y * (this.size.width + 1) + x];
  }
}
