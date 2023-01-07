import { Rectangle } from 'pixi.js';
import { GridFileSchema, GRID_FILE_VERSION } from '../actions/gridFile/GridFileSchema';
import { intersects } from '../gridGL/helpers/intersects';
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
  dgraph: Map<[number, number], [number, number][]>;
  onRebuild?: () => void;

  constructor() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.dependency = new GridRenderDependency();
    this.dgraph = new Map<[number, number], [number, number][]>();
  }

  newFile(): void {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.dependency = new GridRenderDependency();
    this.dgraph = new Map<[number, number], [number, number][]>();
    this.onRebuild?.();
  }

  load_file(sheet: GridFileSchema): void {
    this.gridOffsets.populate(sheet.rows, sheet.columns);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.dependency.load(sheet.dependency);
    // this.dgraph = new Map(Object.entries(JSON.parse(sheet.dgraph))); // TODO: I do not think this works
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
      dgraph: JSON.stringify(Object.fromEntries(this.dgraph)),
      version: GRID_FILE_VERSION,
    };
  }

  getCell(x: number, y: number): CellAndFormat | undefined {
    return this.grid.get(x, y);
  }

  getGridBounds(): Rectangle | undefined {
    return intersects.rectangleUnion(this.grid.getGridBounds(), this.borders.getGridBounds());
  }

  debugGetCells(): Cell[] {
    return this.grid.getAllCells();
  }
}
