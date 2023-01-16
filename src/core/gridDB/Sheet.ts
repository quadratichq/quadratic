import { Rectangle } from 'pixi.js';
import { GridFileSchema, GRID_FILE_VERSION } from '../actions/gridFile/GridFileSchema';
import { intersects } from '../gridGL/helpers/intersects';
import { GridBorders } from './GridBorders';
import { GridRenderDependency } from './GridRenderDependency';
import { GridOffsets } from './GridOffsets';
import { CellAndFormat, GridSparse } from './GridSparse';
import { Cell } from './gridTypes';
import { CellDependencyManager } from './CellDependencyManager';

export class Sheet {
  gridOffsets: GridOffsets;
  grid: GridSparse;
  borders: GridBorders;
  render_dependency: GridRenderDependency;
  cell_dependency: CellDependencyManager;
  onRebuild?: () => void;

  constructor() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.render_dependency = new GridRenderDependency();
    this.cell_dependency = new CellDependencyManager();
  }

  newFile(): void {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.render_dependency = new GridRenderDependency();
    this.cell_dependency = new CellDependencyManager();
    this.onRebuild?.();
  }

  load_file(sheet: GridFileSchema): void {
    this.gridOffsets.populate(sheet.rows, sheet.columns);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.render_dependency.load(sheet.render_dependency);
    // TODO: Load cell dependency
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
      render_dependency: this.render_dependency.save(),
      cell_dependency: '', // TODO: Save dgraph
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
