import { Rectangle } from 'pixi.js';
import { Coordinate } from '../gridGL/types/size';
import { CellRectangle } from './CellRectangle';
import { GridOffsets } from './GridOffsets';
import { Cell, CellFormat } from './gridTypes';
import { MinMax } from '../gridGL/types/size';

export interface CellAndFormat {
  cell?: Cell;
  format?: CellFormat;
}

/** Stores all cells and format locations */
export class GridSparse {
  private gridOffsets: GridOffsets;
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  private isEmpty = true;
  cells = new Map<string, CellAndFormat>();

  constructor(gridOffsets: GridOffsets) {
    this.gridOffsets = gridOffsets;
  }

  updateCells(cells: Cell[]): void {
    cells.forEach((cell) => {
      const update = this.cells.get(this.getKey(cell.x, cell.y));
      if (update) {
        update.cell = cell;
      } else {
        this.cells.set(this.getKey(cell.x, cell.y), { cell });
      }
    });
    this.recalculateBounds();
  }

  recalculateBounds(): void {
    if (this.cells.size === 0) {
      this.empty();
      return;
    }
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    this.cells.forEach((cell) => {
      const x = cell.cell?.x ?? cell.format?.x;
      const y = cell.cell?.y ?? cell.format?.y;
      if (x === undefined || y === undefined) {
        throw new Error('Expected CellAndFormat to have defined cell or format');
      } else {
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x);
        this.minY = Math.min(this.minY, y);
        this.maxY = Math.max(this.maxY, y);
      }
    });
  }

  updateFormat(formats: CellFormat[]): void {
    formats.forEach((format) => {
      const update = this.cells.get(this.getKey(format.x, format.y));
      if (update) {
        update.format = format;
      } else {
        this.cells.set(this.getKey(format.x, format.y), { format });
      }
    });
    this.recalculateBounds();
  }

  clearFormat(formats: CellFormat[]): void {
    formats.forEach((format) => {
      const key = this.getKey(format.x, format.y);
      const clear = this.cells.get(key);
      if (clear) {
        delete clear.format;
        if (Object.keys(clear).length === 0) {
          this.cells.delete(key);
        }
      }
    });
    this.recalculateBounds();
  }

  deleteCells(cells: Coordinate[]): void {
    cells.forEach((cell) => {
      const candf = this.cells.get(this.getKey(cell.x, cell.y));
      if (candf) {
        // Delete cell
        delete candf.cell;
        // If cell has no format, also delete the key
        if (candf.format === undefined) {
          this.cells.delete(this.getKey(cell.x, cell.y));
        }
      }
    });
    this.recalculateBounds();
  }

  empty() {
    this.cells.clear();
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
    this.isEmpty = true;
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(cells?: Cell[], formats?: CellFormat[]) {
    if (!cells?.length && !formats?.length) {
      this.empty();
      return;
    }
    this.isEmpty = false;
    this.cells.clear();
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    cells?.forEach((cell) => {
      this.cells.set(this.getKey(cell.x, cell.y), { cell });
      this.minX = Math.min(this.minX, cell.x);
      this.maxX = Math.max(this.maxX, cell.x);
      this.minY = Math.min(this.minY, cell.y);
      this.maxY = Math.max(this.maxY, cell.y);
    });
    formats?.forEach((format) => {
      const key = this.getKey(format.x, format.y);
      const cell = this.cells.get(key);
      if (cell) {
        cell.format = format;
      } else {
        this.cells.set(key, { format });
      }
      if (format.x !== undefined) {
        this.minX = Math.min(this.minX, format.x);
        this.maxX = Math.max(this.maxX, format.x);
      }
      if (format.y !== undefined) {
        this.minY = Math.min(this.minY, format.y);
        this.maxY = Math.max(this.maxY, format.y);
      }
    });
  }

  get(x: number, y: number): CellAndFormat | undefined {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    return this.cells.get(this.getKey(x, y));
  }

  getCell(x: number, y: number): Cell | undefined {
    // if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    // I am not sure were the min and max are coming from, but they are not updated when calling updateCells
    return this.cells.get(this.getKey(x, y))?.cell;
  }

  getFormat(x: number, y: number): CellFormat | undefined {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    return this.cells.get(this.getKey(x, y))?.format;
  }

  getCells(rectangle: Rectangle): CellRectangle {
    return new CellRectangle(rectangle, this);
  }

  getNakedCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
    const cells: Cell[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cell = this.cells.get(this.getKey(x, y));
        if (cell?.cell) {
          cells.push(cell.cell);
        }
      }
    }
    return cells;
  }

  getBounds(bounds: Rectangle): { bounds: Rectangle, boundsWithData: Rectangle } {
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > this.minX ? columnStartIndex.index : this.minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < this.maxX ? columnEndIndex.index : this.maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > this.minY ? rowStartIndex.index : this.minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < this.maxY ? rowEndIndex.index : this.maxY;

    return {
      bounds: new Rectangle(columnStartIndex.index, rowStartIndex.index, columnEndIndex.index - columnStartIndex.index, rowEndIndex.index - rowStartIndex.index),
      boundsWithData: new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart),
    }
  }

  getGridBounds(): Rectangle | undefined {
    if (this.isEmpty) return;
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }

  /** finds the minimum and maximum location for content in a row */
  getRowMinMax(row: number): MinMax {
    let min = Infinity;
    let max = -Infinity;
    for (let x = this.minX; x <= this.maxX; x++) {
      if (this.get(x, row)) {
        min = x;
        break;
      }
    }
    for (let x = this.maxX; x >= this.minX; x--) {
      if (this.get(x, row)) {
        max = x;
        break;
      }
    }
    return { min, max };
  }

  /**finds the minimum and maximum location for content in a column */
  getColumnMinMax(column: number): MinMax | undefined {
    let min = Infinity;
    let max = -Infinity;
    for (let y = this.minY; y <= this.maxY; y++) {
      if (this.get(column, y)) {
        min = y;
        break;
      }
    }
    for (let y = this.maxY; y >= this.minY; y--) {
      if (this.get(column, y)) {
        max = y;
        break;
      }
    }
    if (min === Infinity) return;
    return { min, max };
  }

  getAllCells(): Cell[] {
    const array = Array.from(this.cells, ([_, value]) => value);
    return array.flatMap((entry) => {
      if (entry.cell) return [entry.cell];
      return [];
    });
  }

  getArrays(): { cells: Cell[]; formats: CellFormat[] } {
    const array = Array.from(this.cells, ([name, value]) => value);
    return {
      cells: array.flatMap((entry) => {
        if (entry.cell) return [entry.cell];
        return [];
      }),
      formats: array.flatMap((entry) => {
        if (entry.format) return [entry.format];
        return [];
      }),
    };
  }
}
