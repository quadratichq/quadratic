import { Rectangle } from 'pixi.js';
import CellReference from '../gridGL/types/cellReference';
import { CellRectangle } from './CellRectangle';
import { GridOffsets } from './GridOffsets';
import { Cell, CellFormat } from './gridTypes';

export interface CellAndFormat {
  cell?: Cell;
  format?: CellFormat;
}

export class GridSparse {
  private gridOffsets: GridOffsets;
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
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
  }

  deleteCells(cells: CellReference[]): void {
    cells.forEach((cell) => this.cells.delete(this.getKey(cell.x, cell.y)));
  }

  empty() {
    this.cells.clear();
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(cells?: Cell[], formats?: CellFormat[]) {
    if (!cells?.length && !formats?.length) {
      this.empty();
      return;
    }
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
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
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

  getBounds(bounds: Rectangle): Rectangle {
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > this.minX ? columnStartIndex.index : this.minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < this.maxX ? columnEndIndex.index : this.maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > this.minY ? rowStartIndex.index : this.minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < this.maxY ? rowEndIndex.index : this.maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }

  getGridBounds(): Rectangle {
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }

  getAllCells(): Cell[] {
    const array = Array.from(this.cells, ([name, value]) => value);
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
