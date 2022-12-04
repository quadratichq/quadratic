import { Rectangle } from 'pixi.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Heading } from './gridTypes';
import { UpdateHeading } from './useHeadings';

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
  private columns: Record<string, Heading> = {};
  private rows: Record<string, Heading> = {};
  headingResizing: HeadingResizing | undefined;

  populate(columns: Heading[], rows: Heading[]): void {
    this.columns = {};
    columns.forEach((entry) => (this.columns[entry.id] = entry));
    this.rows = {};
    rows.forEach((entry) => (this.rows[entry.id] = entry));

    // todo: move this somewhere else...
    // this.app.gridLines.dirty = true;
    // this.app.headings.dirty = true;
    // this.app.cursor.dirty = true;
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
   * Gets the screen x-coordinate for a range of columns
   * @param column
   * @param width
   * @returns bounding start and end values
   */
  getColumnsStartEnd(column: number, width: number): { xStart: number; xEnd: number } {
    let position = 0;
    let xStart: number;

    // calculate starting from 0 to column to find xStart and xEnd
    if (column >= 0) {
      for (let x = 0; x < column; x++) {
        position += this.getColumnWidth(x);
      }
      xStart = position;
      for (let x = column; x < column + width; x++) {
        position += this.getColumnWidth(x);
      }
      return { xStart, xEnd: position };
    }

    // calculate starting from -column to 0 to find xStart; xEnd is found in that iteration, or calculated directly if column + width is positive
    else {
      let xEnd: number | undefined;

      // if the column ends at 0 then xEnd = 0
      if (column + width === 0) {
        xEnd = 0;
      }

      // if the column ends at a positive number then xEnd is calculated directly
      else if (column + width > 0) {
        const placement = this.getColumnPlacement(column + width);
        xEnd = placement.x;
      }

      // iterate starting from the -column until we hit -1 to find xStart
      for (let x = -1; x >= column; x--) {
        if (x === column + width - 1) {
          xEnd = position;
        }
        position -= this.getColumnWidth(x);
      }
      return { xStart: position, xEnd: xEnd as number };
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
   * Gets the screen x-coordinate for a range of columns
   * @param column
   * @param width
   * @returns bounding start and end values
   */
  getRowsStartEnd(row: number, height: number): { yStart: number; yEnd: number } {
    let position = 0;
    let yStart: number;

    // calculate starting from 0 to row to find yStart and yEnd
    if (row >= 0) {
      for (let y = 0; y < row; y++) {
        position += this.getRowHeight(y);
      }
      yStart = position;
      for (let y = row; y < row + height; y++) {
        position += this.getRowHeight(y);
      }
      return { yStart, yEnd: position };
    }

    // calculate starting from -row to 0 to find yStart; yEnd is found in that iteration, or calculated directly if row + height is positive
    else {
      let yEnd: number | undefined;

      // if the row ends at 0 then yEnd = 0
      if (row + height === 0) {
        yEnd = 0;
      }

      // if the row ends at a positive number then yEnd is calculated directly
      else if (row + height > 0) {
        const placement = this.getRowPlacement(row + height);
        yEnd = placement.y;
      }

      // iterate starting from the -row until we hit -1 to find yStart
      for (let y = -1; y >= row; y--) {
        if (y === row + height - 1) {
          yEnd = position;
        }
        position -= this.getRowHeight(y);
      }
      return { yStart: position, yEnd: yEnd as number };
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
    const { xStart, xEnd } = this.getColumnsStartEnd(column, width);
    const { yStart, yEnd } = this.getRowsStartEnd(row, height);
    return new Rectangle(xStart, yStart, xEnd - xStart, yEnd - yStart);
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

  delete(options: { rows: number[], columns: number[] }): void {
    options.rows.forEach(row => delete this.rows[row]);
    options.columns.forEach(column => delete this.columns[column]);
  }

  update(change: UpdateHeading): void {
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

  debugRowsColumns(): { rows: Heading[]; columns: Heading[] } {
    return { rows: Object.values(this.rows), columns: Object.values(this.columns) };
  }

  getColumnsArray(): Heading[] {
    return Object.values(this.columns);
  }

  getRowsArray(): Heading[] {
    return Object.values(this.rows);
  }
}
