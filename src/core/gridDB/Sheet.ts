import { Rectangle } from 'pixi.js';
import { GridFileSchema, GRID_FILE_VERSION } from '../actions/gridFile/GridFileSchema';
import QuadraticDependencyGraph from '../dgraph/QuadraticDependencyGraph';
import { intersects } from '../gridGL/helpers/intersects';
import CellReference from '../gridGL/types/cellReference';
import { GridBorders } from './GridBorders';
import { GridRenderDependency } from './GridRenderDependency';
import { GridOffsets } from './GridOffsets';
import { CellAndFormat, GridSparse } from './GridSparse';
import { Cell } from './gridTypes';

export class Sheet {
  gridOffsets: GridOffsets;
  grid: GridSparse;
  borders: GridBorders;
  dependency: GridRenderDependency;
  dgraph: QuadraticDependencyGraph;
  onRebuild?: () => void;

  constructor() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.dependency = new GridRenderDependency();
    this.dgraph = new QuadraticDependencyGraph();
  }

  load_file(sheet: GridFileSchema): void {
    this.gridOffsets.populate(sheet.rows, sheet.columns);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.dependency.load(sheet.dependency);
    this.dgraph.load_from_json(sheet.dgraph);
    this.onRebuild?.();
  }

  export_file(): GridFileSchema {
    const { cells, formats } = this.grid.getArrays();
    return {
      columns: this.gridOffsets.getColumnsArray(),
      rows: this.gridOffsets.getRowsArray(),
      cells,
      formats,
      borders: this.borders.getArray(),
      dependency: this.dependency.save(),
      dgraph: this.dgraph.export_to_json(),
      version: GRID_FILE_VERSION,
    };
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

  debugGetCells(): Cell[] {
    return this.grid.getAllCells();
  }
}
