import { Rectangle } from 'pixi.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { UpdateHeading } from './Cells/UpdateHeadingsDB';
import { Heading } from './db';

export interface HeadingResizing {
  x: number;
  y: number;
  start: number;
  column?: number;
  row?: number;
  width?: number;
  height?: number;
}

export class GridOffsets {
  private app: PixiApp;
  private columns: Record<string, Heading> = {};
  private rows: Record<string, Heading> = {};
  headingResizing: HeadingResizing | undefined;

  constructor(app: PixiApp) {
    this.app = app;
  }

  populate(columns: Heading[], rows: Heading[]): void {
    this.columns = {};
    columns.forEach((entry) => (this.columns[entry.id] = entry));
    this.rows = {};
    rows.forEach((entry) => (this.rows[entry.id] = entry));
    this.app.gridLines.dirty = true;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
  }

  getColumnWidth(column: number): number {
    if (this.headingResizing?.column === column && this.headingResizing?.width !== undefined) {
      return this.headingResizing.width;
    }
    return this.columns[column]?.size ?? CELL_WIDTH;
  }

  getRowHeight(row: number): number {
    if (this.headingResizing?.row === row && this.headingResizing?.height !== undefined) {
      return this.headingResizing.height;
    }
    return this.rows[row]?.size ?? CELL_HEIGHT;
  }

  /**
   * Gets screen location of column
   * @param column
   * @returns x position and width of column
   */
  getColumnPlacement(column: number): { x: number; width: number } {
    let position = 0;
    if (column >= 0) {
      for (let x = 0; x < column; x++) {
        position += this.getColumnWidth(x);
      }
      return { x: position, width: this.getColumnWidth(column) };
    } else {
      for (let x = column; x < 0; x++) {
        position -= this.getColumnWidth(x);
      }
      return { x: position, width: this.getColumnWidth(column) };
    }
  }

  /**
   * Gets screen location of row
   * @param row
   * @returns y position and height of column
   */
  getRowPlacement(row: number): { y: number; height: number } {
    let position = 0;
    if (row >= 0) {
      for (let y = 0; y < row; y++) {
        position += this.getRowHeight(y);
      }
      return { y: position, height: this.getRowHeight(row) };
    } else {
      for (let y = row; y < 0; y++) {
        position -= this.getRowHeight(y);
      }
      return { y: position, height: this.getRowHeight(row) };
    }
  }

  /**
   * Gets column using screen's x-position
   * @param x
   * @returns column and x-position of that column
   */
  getColumnIndex(x: number): { index: number; position: number } {
    if (x >= 0) {
      let index = 0;
      let position = 0;
      let nextWidth = this.getColumnWidth(0);
      while (position + nextWidth < x) {
        position += nextWidth;
        index++;
        nextWidth = this.getColumnWidth(index);
      }
      return { index, position };
    } else {
      let index = 0;
      let position = 0;
      while (position > x) {
        index--;
        position -= this.getColumnWidth(index);
      }
      return { index, position };
    }
  }

  /**
   * Gets row using screen's y-position
   * @param x
   * @returns row and y-position of that row
   */
  getRowIndex(y: number): { index: number; position: number } {
    if (y >= 0) {
      let index = 0;
      let position = 0;
      let nextHeight = this.getRowHeight(0);
      while (position + nextHeight < y) {
        position += nextHeight;
        index++;
        nextHeight = this.getRowHeight(index);
      }
      return { index, position };
    } else {
      let index = 0;
      let position = 0;
      while (position > y) {
        index--;
        position -= this.getRowHeight(index);
      }
      return { index, position };
    }
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
    const xStart = this.getColumnPlacement(column);
    const xEnd = this.getColumnPlacement(column + width);
    const yStart = this.getRowPlacement(row);
    const yEnd = this.getRowPlacement(row + height);
    return new Rectangle(xStart.x, yStart.y, xEnd.x + xEnd.width - xStart.x, yEnd.y + yEnd.height - yStart.y);
  }

  /**
   * gets a column/row rectangle using a screen rectangle
   * @param x
   * @param y
   * @param width
   * @param height
   * @returns
   */
  getCellRectangle(x: number, y: number, width: number, height: number): Rectangle {
    const { column: columnStart, row: rowStart } = this.getRowColumnFromWorld(x, y);
    const { column: columnEnd, row: rowEnd } = this.getRowColumnFromWorld(x + width, y + height);
    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }

  /**
   * optimistically update row/column size instead of waiting for next populate
   * @param change
   */
  optimisticUpdate(change: UpdateHeading): void {
    if (change.row !== undefined) {
      if (this.rows[change.row]) {
        this.rows[change.row].size = change.size;
      } else {
        this.rows[change.row] = { id: change.row, size: change.size };
      }
    } else if (change.column !== undefined) {
      if (this.columns[change.column]) {
        this.columns[change.column].size = change.size;
      } else {
        this.columns[change.column] = { id: change.column, size: change.size };
      }
    }
  }
}
