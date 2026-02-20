/**
 * Shared types and utilities for JavaScript q.cells() implementations.
 *
 * This module contains code shared between the SAB (SharedArrayBuffer) and
 * async implementations of cell access.
 */

// type_u8 as per cellvalue.rs
export enum CellValueType {
  Blank = 0,
  Text = 1,
  Number = 2,
  Logical = 3,
  Duration = 4,
  Error = 5,
  Html = 6,
  Image = 8,
  Date = 9,
  Time = 10,
  DateTime = 11,
}

export type CellType = number | string | boolean | Date | undefined;

export const convertType = (cell: any): CellType => {
  if (cell.t === CellValueType.Blank) return undefined;
  if (cell.t === CellValueType.DateTime || cell.t === CellValueType.Date) return new Date(cell.v);

  return cell.t === CellValueType.Number ? parseFloat(cell.v) : cell.v;
};

export function lineNumber(): number | undefined {
  try {
    throw new Error();
  } catch (e: any) {
    const stackLines = e.stack.split('\n');
    const match = stackLines[3].match(/:(\d+):(\d+)/);
    if (match) {
      return match[1];
    }
  }
}

/**
 * Parse the cells response from core and convert to appropriate return type
 */
export function parseCellsResponse(results: any): CellType | CellType[] | CellType[][] {
  if (!results || !results.values || results.error) {
    throw new Error(results?.error?.core_error ?? 'Failed to get cells');
  }

  const startY = results.values.y;
  const startX = results.values.x;
  const height = results.values.h;
  const width = results.values.w;

  // Initialize 2D array
  const cells: CellType[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(undefined));

  for (const cell of results.values.cells) {
    const typed = cell ? convertType(cell) : undefined;
    cells[cell.y - startY][cell.x - startX] = typed === null ? undefined : typed;
  }

  // always return a single cell as a single value--even in cases where the
  // selection may change.
  if (cells.length === 1 && cells[0].length === 1 && !results.values.one_dimensional) {
    return cells[0][0];
  }

  // Convert to two dimensional if a single row or column and not
  // two-dimensional set. Two dimensional is set when there is an unbounded
  // range that may result in more than two columns or rows--eg, "B:" even
  // where there is only content in the B-column.
  if (!results.values.two_dimensional) {
    // one column result
    if (cells.every((row) => row.length === 1)) {
      return cells.map((row) => row[0]);
    }

    // one row result
    else if (cells.length === 1) {
      return cells[0];
    }
  }
  return cells;
}
