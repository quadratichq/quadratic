import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Heading } from './db';

export class GridOffsets {
  private columns?: Heading[];
  private rows?: Heading[];
  private columnsCached = { minimum: 0, maximum: 0, cache: {} };
  private rowsCached = { minimum: 0, maximum: 0, cache: {} };

  populate(columns: Heading[], rows: Heading[]): void {
    this.columns = columns;
    this.rows = rows;
    this.columnsCache = undefined;
    this.rowsCache = undefined;
  }

  getColumnPlacement(column: number): { x: number, width: number } {
    if (!this.columns) {
      return { x: column * CELL_WIDTH, width: CELL_WIDTH };
    }
    if (this.columnsCachedTo < )
    if (column === 0) {
      const width = this.columns[0]?.size !== undefined ? this.columns[0].size : CELL_WIDTH;
      return { x: 0, width };
    }
    if (column > 0) {
      let xPosition = 0;
      for (let x = 0; x < column; x++) {
        xPosition += this.columns[x]?.size ?? CELL_WIDTH;
      }
      return { x: xPosition, width: this.columns[column]?.size ?? CELL_WIDTH };
    }
    let xPosition = 0;
    for (let x = column; x < 0; x++) {
      xPosition -= this.columns[x]?.size ?? CELL_WIDTH;
    }
    return { x: xPosition, width: this.columns[column]?.size ?? CELL_WIDTH };
  }

  getRowPlacement(row: number): { y: number, height: number } {
    if (!this.rows) {
      return { y: row * CELL_WIDTH, height: CELL_WIDTH };
    }
    if (row === 0) {
      const height = this.rows[0]?.size !== undefined ? this.rows[0].size : CELL_WIDTH;
      return { y: 0, height };
    }
    if (row > 0) {
      let yPosition = 0;
      for (let y = 0; y < row; y++) {
        yPosition += this.rows[y]?.size ?? CELL_HEIGHT;
      }
      return { y: yPosition, height: this.rows[row]?.size ?? CELL_HEIGHT };
    }
    let yPosition = 0;
    for (let y = row; y < 0; y++) {
      yPosition -= this.rows[y]?.size ?? CELL_HEIGHT;
    }
    return { y: yPosition, height: this.rows[row]?.size ?? CELL_HEIGHT };
  }
}
