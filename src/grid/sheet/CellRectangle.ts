import { Rectangle } from 'pixi.js';
import { Border } from '../../schemas';
import { GridBorders } from './GridBorders';
import { CellAndFormat, GridSparse } from './GridSparse';

export class CellRectangle {
  private cells: (CellAndFormat | undefined)[];
  size: Rectangle;
  borders?: Border[];

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

  addBorders(gridBorders: GridBorders): void {
    this.borders = gridBorders.getBorders(this.size);
  }

  get(x: number, y: number): CellAndFormat | undefined {
    return this.cells[y * (this.size.width + 1) + x];
  }
}
