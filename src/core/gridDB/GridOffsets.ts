import { Rectangle } from 'pixi.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Heading } from './gridTypes';
import { HeadingSize } from './useHeadings';
import { GridOffsetsCache } from './GridOffsetsCache';

export interface HeadingResizing {
  x: number;
  y: number;
  start: number;
  end: number;
  column?: number;
  row?: number;
  width?: number;
  height?: number;
}

/** Stores all column and row locations; helper functions to translate between screen and coordinate */
export class GridOffsets {
  private columns: Map<number, Heading> = new Map();
  private rows: Map<number, Heading> = new Map();
  private gridOffsetsCache = new GridOffsetsCache(this);
  headingResizing: HeadingResizing | undefined;

  populate(columns: Heading[], rows: Heading[]): void {
    this.columns.clear();
    columns.forEach((entry) => this.columns.set(entry.id, entry));
    this.rows.clear();
    rows.forEach((entry) => this.rows.set(entry.id, entry));
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
    return entry?.size ?? CELL_WIDTH;
  }

  getCommittedRowHeight(row: number): number {
    // get last saved height
    const entry = this.rows.get(row);
    return entry?.size ?? CELL_HEIGHT;
  }

  /**
   * Gets screen location of column
   * @param column
   * @returns x position and width of column
   */
  getColumnPlacement(column: number): { x: number; width: number } {
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
    return { xStart: start.x, xEnd: end.x - 1 };
  }

  /**
   * Gets screen location of row
   * @param row
   * @returns y position and height of column
   */
  getRowPlacement(row: number): { y: number; height: number } {
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
    return { yStart: start.y, yEnd: end.y - 1 };
  }

  /**
   * Gets column using screen's x-position
   * @param x
   * @returns column and x-position of that column
   */
  getColumnIndex(x: number): { index: number; position: number } {
    return this.gridOffsetsCache.getColumnIndex(x);
  }

  /**
   * Gets row using screen's y-position
   * @param x
   * @returns row and y-position of that row
   */
  getRowIndex(y: number): { index: number; position: number } {
    return this.gridOffsetsCache.getRowIndex(y);
  }

  /**
   * gets row and column based on screen position
   * @param x
   * @param y
   * @returns row and column
   */
  getRowColumnFromWorld(x: number, y: number): { column: number; row: number } {
    return { column: this.getColumnIndex(x).index, row: this.getRowIndex(y).index };
  }

  /**
   * gets cell at row and column
   * @param column
   * @param row
   * @returns
   */
  getCell(column: number, row: number): { x: number; y: number; width: number; height: number } {
    const columnPlacement = this.getColumnPlacement(column);
    const rowPlacement = this.getRowPlacement(row);
    return {
      x: columnPlacement.x,
      y: rowPlacement.y,
      width: columnPlacement.width,
      height: rowPlacement.height,
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

  update(change: HeadingSize): void {
    if (change.row !== undefined) {
      const entry = this.rows.get(change.row);
      if (entry) {
        entry.size = change.size;
      } else {
        this.rows.set(change.row, { id: change.row, size: change.size });
      }
    } else if (change.column !== undefined) {
      const entry = this.columns.get(change.column);
      if (entry) {
        entry.size = change.size;
      } else {
        this.columns.set(change.column, { id: change.column, size: change.size });
      }
    }
  }

  debugRowsColumns(): { rows: Heading[]; columns: Heading[] } {
    const rows = this.getRowsArray();
    const columns = this.getColumnsArray();
    return { rows, columns };
  }

  debugCache(): void {
    this.gridOffsetsCache.debugSize();
  }

  getColumnsArray(): Heading[] {
    const columns: Heading[] = [];
    this.columns.forEach((column) => columns.push(column));
    return columns;
  }

  getRowsArray(): Heading[] {
    const rows: Heading[] = [];
    this.rows.forEach((row) => rows.push(row));
    return rows;
  }
}
