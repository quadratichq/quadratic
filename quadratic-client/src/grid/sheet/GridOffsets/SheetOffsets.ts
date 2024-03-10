import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { SheetOffsets as SheetOffsetsRust } from '@/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { SheetOffsetsCache } from './SheetOffsetsCache';
export interface HeadingResizing {
  // x: number;
  // y: number;
  // start: number;
  // end: number;
  column?: number;
  row?: number;
  width?: number;
  height?: number;
}

/** Stores all column and row locations; helper functions to translate between screen and coordinate */
export class SheetOffsets {
  private columns: Map<number, number> = new Map();
  private rows: Map<number, number> = new Map();
  private gridOffsetsCache = new SheetOffsetsCache(this);
  headingResizing: HeadingResizing | undefined;

  defaultWidth = 0;
  defaultHeight = 0;

  constructor(offsets?: string) {
    if (offsets) {
      this.load(offsets);
    }
  }

  load(offsets: string) {
    const { column_widths, row_heights } = JSON.parse(offsets) as SheetOffsetsRust;
    this.defaultWidth = column_widths.default;
    this.defaultHeight = row_heights.default;
    this.columns.clear();
    for (const key in column_widths.sizes) {
      // this is needed since Rust passes the key as a bigint, which cannot be used to iterate over an Record
      this.columns.set(Number(key), (column_widths.sizes as number[])[Number(key)]);
    }
    this.rows.clear();
    for (const key in row_heights.sizes) {
      // this is needed since Rust passes the key as a bigint, which cannot be used to iterate over an Record
      this.rows.set(Number(key), (row_heights.sizes as number[])[Number(key)]);
    }
    this.gridOffsetsCache.clear();
  }

  getColumnWidth(column: number): number {
    // if resizing in progress get from headingResizing
    if (this.headingResizing?.column === column && this.headingResizing?.width !== undefined) {
      return this.headingResizing.width;
    }
    return this.getCommittedColumnWidth(column);
  }

  getRowHeight(row: number): number {
    // if resizing in progress get from headingResizing
    if (this.headingResizing?.row === row && this.headingResizing?.height !== undefined) {
      return this.headingResizing.height;
    }
    return this.getCommittedRowHeight(row);
  }

  getCommittedColumnWidth(column: number): number {
    // get last saved width
    const entry = this.columns.get(column);
    return entry ?? CELL_WIDTH;
  }

  getCommittedRowHeight(row: number): number {
    // get last saved height
    const entry = this.rows.get(row);
    return entry ?? CELL_HEIGHT;
  }

  /**
   * Gets screen location of column
   * @param column
   * @returns x position and width of column
   */
  getColumnPlacement(column: number): { position: number; size: number } {
    return this.gridOffsetsCache.getColumnPlacement(column);
  }

  /**
   * Gets the screen x-coordinate for a range of columns
   * @param column
   * @param width
   * @returns bounding start and end values
   */
  getColumnsStartEnd(column: number, width: number): { xStart: number; xEnd: number } {
    const start = this.gridOffsetsCache.getColumnPlacement(column);
    const end = this.gridOffsetsCache.getColumnPlacement(column + width);
    return { xStart: start.position, xEnd: end.position - 1 };
  }

  /**
   * Gets screen location of row
   * @param row
   * @returns y position and height of column
   */
  getRowPlacement(row: number): { position: number; size: number } {
    return this.gridOffsetsCache.getRowPlacement(row);
  }

  /**
   * Gets the screen x-coordinate for a range of columns
   * @param column
   * @param width
   * @returns bounding start and end values
   */
  getRowsStartEnd(row: number, height: number): { yStart: number; yEnd: number } {
    const start = this.gridOffsetsCache.getRowPlacement(row);
    const end = this.gridOffsetsCache.getRowPlacement(row + height);
    return { yStart: start.position, yEnd: end.position - 1 };
  }

  /**
   * Gets column using screen's x-position
   * @param x
   * @returns column and x-position of that column
   */
  getXPlacement(x: number): { index: number; position: number; size: number } {
    const result = this.gridOffsetsCache.getColumnIndex(x);
    return { ...result, size: this.getColumnWidth(result.index) };
  }

  /**
   * Gets row using screen's y-position
   * @param x
   * @returns row and y-position of that row
   */
  getYPlacement(y: number): { index: number; position: number; size: number } {
    const result = this.gridOffsetsCache.getRowIndex(y);
    return { ...result, size: this.getRowHeight(result.index) };
  }

  /**
   * gets row and column based on screen position
   * @param x
   * @param y
   * @returns row and column
   */
  getColumnRowFromScreen(x: number, y: number): { column: number; row: number } {
    return { column: this.getXPlacement(x).index, row: this.getYPlacement(y).index };
  }

  /**
   * gets cell at row and column
   * @param column
   * @param row
   * @returns
   */
  getCellOffsets(column: number, row: number): { x: number; y: number; w: number; h: number } {
    const columnPlacement = this.getColumnPlacement(column);
    const rowPlacement = this.getRowPlacement(row);
    return {
      x: columnPlacement.position,
      y: rowPlacement.position,
      w: columnPlacement.size,
      h: rowPlacement.size,
    };
  }

  /**
   * gets a screen rectangle using a column/row rectangle
   * @param column
   * @param row
   * @param width
   * @param height
   * @returns the screen rectangle
   */
  getScreenRectangle(column: number, row: number, width: number, height: number): Rectangle {
    const { xStart, xEnd } = this.getColumnsStartEnd(column, width);
    const { yStart, yEnd } = this.getRowsStartEnd(row, height);
    return new Rectangle(xStart, yStart, xEnd - xStart, yEnd - yStart);
  }

  delete(options: { rows: number[]; columns: number[] }): void {
    options.rows.forEach((row) => this.rows.delete(row));
    options.columns.forEach((column) => this.columns.delete(column));
  }

  setColumnWidth(column: number, size: number) {
    this.columns.set(column, size);
  }

  setRowHeight(row: number, size: number) {
    this.rows.set(row, size);
  }

  debugRowsColumns(): { columns: number[]; rows: number[] } {
    return {
      columns: Array.from(this.columns.keys()),
      rows: Array.from(this.rows.keys()),
    };
  }

  cancelResize() {
    this.headingResizing = undefined;
  }

  resizeColumnTransiently(column: number, size: number = CELL_WIDTH) {
    this.headingResizing = { column, width: size };
  }

  resizeRowTransiently(row: number, size: number = CELL_HEIGHT) {
    this.headingResizing = { row, height: size };
  }

  getResizeToApply(): { column?: number; row?: number; size: number } | undefined {
    if (this.headingResizing?.column !== undefined) {
      return { column: this.headingResizing.column, size: this.headingResizing.width ?? CELL_WIDTH };
    } else if (this.headingResizing?.row !== undefined) {
      return { row: this.headingResizing.row, size: this.headingResizing.height ?? CELL_HEIGHT };
    }
  }

  getRangeColumnWidth(columnStart: number, columnEnd: number): number {
    let width = 0;
    for (let i = columnStart; i <= columnEnd; i++) {
      width += this.columns.get(i) ?? CELL_WIDTH;
    }
    return width;
  }

  getRangeRowHeight(rowStart: number, rowEnd: number): number {
    let height = 0;
    for (let i = rowStart; i <= rowEnd; i++) {
      height += this.rows.get(i) ?? CELL_HEIGHT;
    }
    return height;
  }
}
