import { Rectangle } from 'pixi.js';
import { GridFileSchema, GRID_FILE_VERSION } from '../actions/gridFile/GridFileSchema';
import { intersects } from '../gridGL/helpers/intersects';
import { GridBorders } from './GridBorders';
import { GridRenderDependency } from './GridRenderDependency';
import { GridOffsets } from './GridOffsets';
import { GridSparse } from './GridSparse';
import { Cell } from './gridTypes';
import { CellDependencyManager } from './CellDependencyManager';
import { Coordinate } from '../gridGL/types/size';

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
    this.gridOffsets.populate(sheet.columns, sheet.rows);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.render_dependency.load(sheet.render_dependency);
    this.cell_dependency.loadFromString(sheet.cell_dependency);
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
      cell_dependency: this.cell_dependency.exportToString(),
      version: GRID_FILE_VERSION,
    };
  }

  getCellCopy(x: number, y: number): Cell | undefined {
    // proper deep copy of a cell
    const cell = this.grid.get(x, y);
    if (!cell || !cell.cell) return;
    return {
      ...cell.cell,
      evaluation_result: cell.cell.evaluation_result ? { ...cell.cell.evaluation_result } : undefined, // copy eval result
    };
  }

  /** finds grid bounds based on GridSparse, GridBounds, and GridRenderDependency */
  getGridBounds(): Rectangle | undefined {
    return intersects.rectangleUnion(
      this.grid.getGridBounds(),
      this.borders.getGridBounds(),
      this.render_dependency.getGridBounds()
    );
  }

  getMinMax(): Coordinate[] | undefined {
    const bounds = this.getGridBounds();
    if (!bounds) return;
    return [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
    ];
  }

  getGridRowMinMax(row: number): Coordinate[] | undefined {
    const gridRowMinMax = this.grid.getRowMinMax(row);
    const bordersRowMinMax = this.borders.getRowMinMax(row);
    if (!gridRowMinMax && !bordersRowMinMax) return;
    if (!gridRowMinMax) {
      return [
        { x: bordersRowMinMax.min, y: row },
        { x: bordersRowMinMax.max, y: row },
      ];
    }
    if (!bordersRowMinMax) {
      return [
        { x: gridRowMinMax.min, y: row },
        { x: gridRowMinMax.max, y: row },
      ];
    }
    return [
      { x: Math.min(gridRowMinMax.min, bordersRowMinMax.min), y: row },
      { x: Math.max(gridRowMinMax.max, bordersRowMinMax.max), y: row },
    ];
  }

  getGridColumnMinMax(column: number): Coordinate[] | undefined {
    const gridColumnMinMax = this.grid.getColumnMinMax(column);
    const bordersColumnMinMax = this.borders.getColumnMinMax(column);
    if (!gridColumnMinMax && !bordersColumnMinMax) return;
    if (!gridColumnMinMax) {
      return [
        { x: column, y: bordersColumnMinMax!.min },
        { x: column, y: bordersColumnMinMax!.max },
      ];
    }
    if (!bordersColumnMinMax) {
      return [
        { x: column, y: gridColumnMinMax.min },
        { x: column, y: gridColumnMinMax.max },
      ];
    }
    return [
      { x: column, y: Math.min(gridColumnMinMax.min, bordersColumnMinMax.min) },
      { x: column, y: Math.max(gridColumnMinMax.max, bordersColumnMinMax.max) },
    ];
  }

  hasQuadrant(x: number, y: number): boolean {
    return this.grid.hasQuadrant(x, y) || this.borders.hasQuadrant(x, y);
  }

  debugGetCells(): Cell[] {
    return this.grid.getAllCells();
  }
}
