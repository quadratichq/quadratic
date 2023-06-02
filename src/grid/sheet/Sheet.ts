import { Rectangle } from 'pixi.js';
import { GridFileData, GridFile } from '../../schemas';
import { intersects } from '../../gridGL/helpers/intersects';
import { GridBorders } from './GridBorders';
import { GridRenderDependency } from './GridRenderDependency';
import { GridOffsets } from './GridOffsets';
import { CellAndFormat, GridSparse } from './GridSparse';
import { Cell, CellFormat } from '../../schemas';
import { CellDependencyManager } from './CellDependencyManager';
import { Coordinate } from '../../gridGL/types/size';

export class Sheet {
  gridOffsets: GridOffsets;
  grid: GridSparse;
  borders: GridBorders;

  // visual dependency for overflowing cells
  render_dependency: GridRenderDependency;

  // visual dependency for drawing array lines
  array_dependency: GridRenderDependency;

  // cell calculation dependency
  cell_dependency: CellDependencyManager;

  onRebuild?: () => void;

  constructor() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this.gridOffsets);
    this.borders = new GridBorders(this.gridOffsets);
    this.render_dependency = new GridRenderDependency();
    this.array_dependency = new GridRenderDependency();
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

  load_file(sheet: GridFile): void {
    this.gridOffsets.populate(sheet.columns, sheet.rows);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.cell_dependency.loadFromString(sheet.cell_dependency);
    this.onRebuild?.();
  }

  export_file(): GridFileData {
    const { cells, formats } = this.grid.getArrays();
    return {
      columns: this.gridOffsets.getColumnsArray(),
      rows: this.gridOffsets.getRowsArray(),
      cells,
      formats,
      borders: this.borders.getArray(),
      cell_dependency: this.cell_dependency.exportToString(),
    };
  }

  private copyCell(cell: Cell | undefined): Cell | undefined {
    if (!cell) return undefined;
    return {
      ...cell,
      evaluation_result: cell.evaluation_result ? { ...cell.evaluation_result } : undefined,
    };
  }

  private copyFormat(format: CellFormat | undefined): CellFormat | undefined {
    if (!format) return undefined;
    return {
      ...format,
      textFormat: format.textFormat ? { ...format.textFormat } : undefined,
    };
  }

  getCellCopy(x: number, y: number): Cell | undefined {
    // proper deep copy of a cell
    const cell = this.grid.get(x, y);
    if (!cell || !cell.cell) return;
    return this.copyCell(cell.cell);
  }

  getCellAndFormatCopy(x: number, y: number): CellAndFormat | undefined {
    const cell = this.grid.get(x, y);
    if (!cell) return;
    return {
      cell: this.copyCell(cell.cell),
      format: this.copyFormat(cell.format),
    };
  }

  /** finds grid bounds based on GridSparse, GridBounds, and GridRenderDependency */
  getGridBounds(onlyData: boolean): Rectangle | undefined {
    if (onlyData) {
      return this.grid.getGridBounds(true);
    }
    return intersects.rectangleUnion(
      this.grid.getGridBounds(false),
      this.borders.getGridBounds(),
      this.render_dependency.getGridBounds()
    );
  }

  getMinMax(onlyData: boolean): Coordinate[] | undefined {
    const bounds = this.getGridBounds(onlyData);
    if (!bounds) return;
    return [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
    ];
  }

  getGridRowMinMax(row: number, onlyData: boolean): Coordinate[] | undefined {
    const gridRowMinMax = this.grid.getRowMinMax(row, onlyData);
    if (onlyData) {
      if (!gridRowMinMax) return;
      return [
        { x: gridRowMinMax.min, y: row },
        { x: gridRowMinMax.max, y: row },
      ];
    }
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

  getGridColumnMinMax(column: number, onlyData: boolean): Coordinate[] | undefined {
    const gridColumnMinMax = this.grid.getColumnMinMax(column, onlyData);
    if (onlyData) {
      if (!gridColumnMinMax) return;
      return [
        { x: column, y: gridColumnMinMax.min },
        { x: column, y: gridColumnMinMax.max },
      ];
    }
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
    return (
      this.grid.hasQuadrant(x, y) ||
      this.borders.hasQuadrant(x, y) ||
      this.render_dependency.hasQuadrant(x, y) ||
      this.array_dependency.hasQuadrant(x, y)
    );
  }

  debugGetCells(): Cell[] {
    return this.grid.getAllCells();
  }
}
