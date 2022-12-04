import { Rectangle } from 'pixi.js';
import { GridFileSchema } from '../actions/gridFile/GridFileSchema';
import { intersects } from '../gridGL/helpers/intersects';
import CellReference from '../gridGL/types/cellReference';
import { Coordinate } from '../gridGL/types/size';
import { GridBorders } from './GridBorders';
import { GridOffsets } from './GridOffsets';
import { CellAndFormat, GridSparse } from './GridSparse';
import { Cell } from './gridTypes';

export class Sheet {
  gridOffsets: GridOffsets;
  grid: GridSparse;
  borders: GridBorders;

  constructor() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
  }

  getJSON(): string {
    return JSON.stringify({
      columns: this.gridOffsets.getColumnsArray(),
      rows: this.gridOffsets.getRowsArray(),
      cells: Object.values(this.grid.cells),
      borders: this.borders.getArray(),
    });
  }

  load(gridFile: GridFileSchema): void {
    this.gridOffsets.populate(gridFile.columns, gridFile.rows);
    this.grid.populate(gridFile.cells);
    this.borders.populate(gridFile.borders);
  }

  getCell(x: number, y: number): CellAndFormat | undefined {
    return this.grid.get(x, y);
  }

  deleteCells(cells: CellReference[]): void {
    this.grid.deleteCells(cells);
  }

  deleteCellsRange(x0: number, y0: number, x1?: number, y1?: number): void {
    if (x1 === undefined || y1 === undefined) {
      this.grid.deleteCells([{ x: x0, y: y0 }]);
      return;
    }
    if (y0 > y1) {
      const swap = y0;
      y0 = y1;
      y1 = swap;
    }
    if (x0 > x1) {
      const swap = x0;
      x0 = x1;
      x1 = swap;
    }
    const cells: CellReference[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        cells.push({ x, y });
      }
    }
    this.grid.deleteCells(cells);
  }

  updateCells(cells: Cell[]): void {
    this.grid.updateCells(cells);
  }

  getGridBounds(): Rectangle | undefined {
    return intersects.rectangleUnion(this.grid.getGridBounds(), this.borders.getGridBounds());
  }
}