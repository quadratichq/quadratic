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

  /**
   * adds a simple list of borders in the CellRectangle's cells (does not create a full array like cells for now)
   * @param gridBorders
   * @param extend - extends borders one to the right and one down (to cover "neighboring" border)
   */
  addBorders(gridBorders: GridBorders, extend?: boolean): void {
    if (extend) {
      this.borders = gridBorders.getBorders(
        new Rectangle(this.size.left, this.size.top, this.size.width + 1, this.size.height + 1)
      );
    } else {
      this.borders = gridBorders.getBorders(this.size);
    }
  }

  get(x: number, y: number): CellAndFormat | undefined {
    return this.cells[y * (this.size.width + 1) + x];
  }

  getBorder(x: number, y: number): Border | undefined {
    return this.borders?.find((border) => border.x === x && border.y === y);
  }
}
