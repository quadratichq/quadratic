import { Rectangle } from 'pixi.js';
import { Coordinate } from '../../gridGL/types/size';
import { CellRectangle } from './CellRectangle';
import { GridOffsets } from './GridOffsets';
import { Cell, CellFormat } from './gridTypes';
import { MinMax } from '../../gridGL/types/size';
import { Quadrants } from '../../gridGL/quadrants/Quadrants';
import { Bounds } from './Bounds';
import { cellHasContent } from '../../gridGL/helpers/selectCells';

export interface CellAndFormat {
  cell?: Cell;
  format?: CellFormat;
}

/** Stores all cells and format locations */
export class GridSparse {
  private gridOffsets: GridOffsets;
  private cellBounds = new Bounds();
  private formatBounds = new Bounds();
  private cellFormatBounds = new Bounds();
  cells = new Map<string, CellAndFormat>();

  // tracks which quadrants need to render based on GridSparse data
  quadrants = new Set<string>();

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
        this.quadrants.add(Quadrants.getKey(cell.x, cell.y));
      }
    });
    this.recalculateBounds();
  }

  recalculateBounds(): void {
    this.cellBounds.clear();
    this.cellFormatBounds.clear();
    this.formatBounds.clear();
    if (this.cells.size === 0) return;
    this.cells.forEach((cell) => {
      if (cell.cell) {
        this.cellBounds.add(cell.cell.x, cell.cell.y);
        this.cellBounds.add(cell.cell.x, cell.cell.y);
      }
      if (cell.format) {
        this.formatBounds.add(cell.format.x, cell.format.y);
      }
    });
    this.cellFormatBounds.mergeInto(this.cellBounds, this.formatBounds);
  }

  updateFormat(formats: CellFormat[]): void {
    formats.forEach((format) => {
      const update = this.cells.get(this.getKey(format.x, format.y));
      if (update) {
        update.format = format;
      } else {
        this.cells.set(this.getKey(format.x, format.y), { format });
      }
      this.formatBounds.add(format.x, format.y);
      this.cellFormatBounds.add(format.x, format.y);
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

  get empty(): boolean {
    return this.cellFormatBounds.empty;
  }

  clear() {
    this.cells.clear();
    this.quadrants.clear();
    this.cellBounds.clear();
    this.formatBounds.clear();
    this.cellFormatBounds.clear();
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(cells?: Cell[], formats?: CellFormat[]) {
    this.clear();
    if (!cells?.length && !formats?.length) return;
    cells?.forEach((cell) => {
      this.cells.set(this.getKey(cell.x, cell.y), { cell });
      this.quadrants.add(Quadrants.getKey(cell.x, cell.y));
      this.cellBounds.add(cell.x, cell.y);
    });
    formats?.forEach((format) => {
      const key = this.getKey(format.x, format.y);
      const cell = this.cells.get(key);
      if (cell) {
        cell.format = format;
      } else {
        this.cells.set(key, { format });
      }
      this.formatBounds.add(format.x, format.y);
    });
    this.cellFormatBounds.mergeInto(this.cellBounds, this.formatBounds);
  }

  get(x: number, y: number): CellAndFormat | undefined {
    if (this.cellFormatBounds.contains(x, y)) {
      return this.cells.get(this.getKey(x, y));
    }
  }

  getCell(x: number, y: number): Cell | undefined {
    if (this.cellBounds.contains(x, y)) {
      return this.cells.get(this.getKey(x, y))?.cell;
    }
  }

  getFormat(x: number, y: number): CellFormat | undefined {
    if (this.formatBounds.contains(x, y)) {
      return this.cells.get(this.getKey(x, y))?.format;
    }
  }

  getCells(rectangle: Rectangle): CellRectangle {
    return new CellRectangle(rectangle, this);
  }

  getNakedCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
    const cells: Cell[] = [];
    this.cells.forEach((cell) => {
      if (cell.cell && cell.cell.x >= x0 && cell.cell.x <= x1 && cell.cell.y >= y0 && cell.cell.y <= y1) {
        cells.push(cell.cell);
      }
    });
    return cells;
  }

  getNakedFormat(x0: number, y0: number, x1: number, y1: number): CellFormat[] {
    const cells: CellFormat[] = [];
    this.cells.forEach((cell) => {
      if (cell.format) {
        if (cell.format.x >= x0 && cell.format.x <= x1 && cell.format.y >= y0 && cell.format.y <= y1) {
          cells.push(cell.format);
        }
      }
    });
    return cells;
  }

  getBounds(bounds: Rectangle): { bounds: Rectangle; boundsWithData: Rectangle | undefined } {
    const { minX, minY, maxX, maxY, empty } = this.cellFormatBounds;
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > minX ? columnStartIndex.index : minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < maxX ? columnEndIndex.index : maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > minY ? rowStartIndex.index : minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < maxY ? rowEndIndex.index : maxY;

    return {
      bounds: new Rectangle(
        columnStartIndex.index,
        rowStartIndex.index,
        columnEndIndex.index - columnStartIndex.index,
        rowEndIndex.index - rowStartIndex.index
      ),
      boundsWithData: empty
        ? undefined
        : new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart),
    };
  }

  getGridBounds(onlyData: boolean): Rectangle | undefined {
    if (onlyData) {
      return this.cellBounds.toRectangle();
    }
    return this.cellFormatBounds.toRectangle();
  }

  /** finds the minimum and maximum location for content in a row */
  getRowMinMax(row: number, onlyData: boolean): MinMax | undefined {
    const { minX, maxX, empty } = this.cellFormatBounds;
    if (empty) return;
    let min = Infinity;
    let max = -Infinity;
    for (let x = minX; x <= maxX; x++) {
      const entry = this.get(x, row);
      if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
        min = x;
        break;
      }
    }
    for (let x = maxX; x >= minX; x--) {
      const entry = this.get(x, row);
      if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
        max = x;
        break;
      }
    }
    if (min === Infinity) return;
    return { min, max };
  }

  /**finds the minimum and maximum location for content in a column */
  getColumnMinMax(column: number, onlyData: boolean): MinMax | undefined {
    const { minY, maxY, empty } = this.cellFormatBounds;
    if (empty) return;
    let min = Infinity;
    let max = -Infinity;
    for (let y = minY; y <= maxY; y++) {
      const entry = this.get(column, y);
      if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
        min = y;
        break;
      }
    }
    for (let y = maxY; y >= minY; y--) {
      const entry = this.get(column, y);
      if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
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
    const array = Array.from(this.cells, ([_, value]) => value);
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

  hasQuadrant(x: number, y: number): boolean {
    return this.quadrants.has(Quadrants.getKey(x, y));
  }

  /**
   * finds the next column with or without content
   * @param options
   * @param xStart where to start looking
   * @param y the row to look in
   * @param delta 1 or -1
   * @param withContent if true, will find the next column with content, if false, will find the next column without content
   * @returns the found column or the original column if nothing was found
   */
  findNextColumn(options: { xStart: number; y: number; delta: 1 | -1; withContent: boolean }): number {
    const { xStart, delta, y, withContent } = options;
    const bounds = this.cellBounds;
    if (!bounds) return xStart;
    let x = delta === 1 ? Math.max(xStart, bounds.minX) : Math.min(xStart, bounds.maxX);

    // -1 and +1 are to cover where the cell at the bounds should be returned
    while (x >= bounds.minX - 1 && x <= bounds.maxX + 1) {
      const hasContent = cellHasContent(this.get(x, y)?.cell);
      if ((withContent && hasContent) || (!withContent && !hasContent)) {
        return x;
      }
      x += delta;
    }
    return xStart;
  }

  /**
   * finds the next row with or without content
   * @param options
   * @param yStart where to start looking
   * @param x the column to look in
   * @param delta 1 or -1
   * @param withContent if true, will find the next column with content, if false, will find the next column without content
   * @returns the found row or the original row if nothing was found
   */
  findNextRow(options: { yStart: number; x: number; delta: 1 | -1; withContent: boolean }): number {
    const { yStart, delta, x, withContent } = options;
    const bounds = this.cellBounds;
    if (!bounds) return yStart;
    let y = delta === 1 ? Math.max(yStart, bounds.minY) : Math.min(yStart, bounds.maxY);

    // -1 and +1 are to cover where the cell at the bounds should be returned
    while (y >= bounds.minY - 1 && y <= bounds.maxY + 1) {
      const hasContent = cellHasContent(this.get(x, y)?.cell);
      if ((withContent && hasContent) || (!withContent && !hasContent)) {
        return y;
      }
      y += delta;
    }
    return yStart;
  }
}
