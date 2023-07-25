import { Rectangle } from 'pixi.js';
import { intersects } from '../../gridGL/helpers/intersects';
import { Coordinate } from '../../gridGL/types/size';
import { File as CoreFile } from '../../quadratic-core/quadratic_core';
import { Cell, CellFormat, SheetSchema } from '../../schemas';
import { CellDependencyManager } from './CellDependencyManager';
import { GridBorders } from './GridBorders';
import { GridOffsets } from './GridOffsets';
import { GridRenderDependency } from './GridRenderDependency';
import { CellAndFormat, GridSparse } from './GridSparse';
import { GridSparseRust } from './GridSparseRust';
import { Sheet } from './Sheet';
import { SheetCursor } from './SheetCursor';

export class SheetRust extends Sheet {
  constructor(file: CoreFile, sheetIndex: number, name: string | undefined, order: string, copyFrom?: Sheet) {
    super(name, order, copyFrom);
    this.grid = new GridSparseRust(file, sheetIndex, this);
  }

  // for testing
  clear() {
    this.gridOffsets = new GridOffsets();
    this.grid = new GridSparse(this);
    this.borders = new GridBorders(this.gridOffsets);
    this.render_dependency = new GridRenderDependency();
    this.array_dependency = new GridRenderDependency();
    this.cell_dependency = new CellDependencyManager();
    this.cursor = new SheetCursor(this);
  }

  rename(name: string) {
    this.name = name;
  }

  load_file(sheet: SheetSchema): void {
    this.name = sheet.name;
    this.color = sheet.color;
    this.gridOffsets.populate(sheet.columns, sheet.rows);
    this.grid.populate(sheet.cells, sheet.formats);
    this.borders.populate(sheet.borders);
    this.cell_dependency.loadFromString(sheet.cell_dependency);
  }

  export_file(): SheetSchema {
    const { cells, formats } = this.grid.getArrays();
    return {
      name: this.name,
      color: this.color,
      order: this.order,
      columns: this.gridOffsets.getColumnsArray(),
      rows: this.gridOffsets.getRowsArray(),
      cells,
      formats,
      borders: this.borders.getArray(),
      cell_dependency: this.cell_dependency.exportToString(),
    };
  }

  protected copyCell(cell: Cell | undefined): Cell | undefined {
    if (!cell) return undefined;
    return {
      ...cell,
      evaluation_result: cell.evaluation_result ? { ...cell.evaluation_result } : undefined,
    };
  }

  protected copyFormat(format: CellFormat | undefined): CellFormat | undefined {
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
