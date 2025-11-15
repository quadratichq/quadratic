import type { Rect } from '@/app/quadratic-core-types';

// calculates the fade alpha for grid when zooming out
export function calculateAlphaForGridLines(scale: number): number {
  return scale < 0.1 ? 0 : scale < 0.6 ? scale * 2 - 0.2 : 1;
}

/**
 * Precalculates which column ranges should be excluded for a given row due to merged cells.
 * Similar to getRowHorizontalRange, but for merged cells.
 * Returns an array of [x0, x1] ranges that should be excluded.
 */
export function getMergedCellExcludedColumnsForRow(
  row: number,
  columns: [number, number],
  mergedRects: Rect[]
): [number, number][] {
  if (mergedRects.length === 0) {
    return [];
  }

  // A horizontal line at row is between row-1 and row
  // We exclude columns where the row is inside a merged cell (not on top or bottom edge)
  const excludedColumns: number[] = [];
  const rowBigInt = BigInt(row);

  for (const mergeRect of mergedRects) {
    // Check if row is inside the merged cell or on edges
    // A horizontal line at row N is between rows N-1 and N
    // For single-row merged cells (min.y = max.y = R):
    //   - Line at row R (top edge, between R-1 and R) should be excluded
    //   - Line at row R+1 (bottom edge, between R and R+1) should be excluded
    // For multi-row merged cells (min.y < max.y):
    //   - Internal lines only (not on top or bottom edges)
    const isSingleRow = mergeRect.min.y === mergeRect.max.y;
    const isInside = isSingleRow
      ? rowBigInt === mergeRect.min.y || rowBigInt === mergeRect.min.y + BigInt(1) // For single row, exclude both edges
      : mergeRect.min.y < rowBigInt && rowBigInt <= mergeRect.max.y; // For multi-row, exclude internal lines
    if (isInside) {
      // Add all columns in the merged cell that overlap with the visible range
      const startCol = Math.max(Number(mergeRect.min.x), columns[0]);
      const endCol = Math.min(Number(mergeRect.max.x), columns[1]);
      for (let x = startCol; x <= endCol; x++) {
        excludedColumns.push(x);
      }
    }
  }

  if (excludedColumns.length === 0) {
    return [];
  }

  // Sort and deduplicate
  excludedColumns.sort((a, b) => a - b);
  const unique = Array.from(new Set(excludedColumns));

  if (unique.length === 0) {
    return [];
  }

  // Convert to ranges - handle multiple separate ranges correctly
  const ranges: [number, number][] = [];
  let rangeStart = unique[0];
  let rangeEnd = unique[0];

  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === rangeEnd + 1) {
      // Consecutive, extend current range
      rangeEnd = unique[i];
    } else {
      // Gap found, save current range and start new one
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = unique[i];
      rangeEnd = unique[i];
    }
  }
  // Don't forget the last range
  ranges.push([rangeStart, rangeEnd]);

  return ranges;
}

/**
 * Precalculates which row ranges should be excluded for a given column due to merged cells.
 * Similar to getColumnVerticalRange, but for merged cells.
 * Returns an array of [y0, y1] ranges that should be excluded.
 */
export function getMergedCellExcludedRowsForColumn(
  column: number,
  rows: [number, number],
  mergedRects: Rect[]
): [number, number][] {
  if (mergedRects.length === 0) {
    return [];
  }

  // A vertical line at column is between column-1 and column
  // We exclude rows where the column is inside a merged cell (not on left or right edge)
  const excludedRows: number[] = [];
  const colBigInt = BigInt(column);

  for (const mergeRect of mergedRects) {
    // Check if column is inside the merged cell or on edges
    // A vertical line at column N is between columns N-1 and N
    // For single-column merged cells (min.x = max.x = C):
    //   - Line at column C (left edge, between C-1 and C) should be excluded
    //   - Line at column C+1 (right edge, between C and C+1) should be excluded
    // For multi-column merged cells (min.x < max.x):
    //   - Internal lines only (not on left or right edges)
    const isSingleColumn = mergeRect.min.x === mergeRect.max.x;
    const isInside = isSingleColumn
      ? colBigInt === mergeRect.min.x || colBigInt === mergeRect.min.x + BigInt(1) // For single column, exclude both edges
      : mergeRect.min.x < colBigInt && colBigInt <= mergeRect.max.x; // For multi-column, exclude internal lines
    if (isInside) {
      // Add all rows in the merged cell that overlap with the visible range
      const startRow = Math.max(Number(mergeRect.min.y), rows[0]);
      const endRow = Math.min(Number(mergeRect.max.y), rows[1]);
      for (let y = startRow; y <= endRow; y++) {
        excludedRows.push(y);
      }
    }
  }

  if (excludedRows.length === 0) {
    return [];
  }

  // Sort and deduplicate
  excludedRows.sort((a, b) => a - b);
  const unique = Array.from(new Set(excludedRows));

  if (unique.length === 0) {
    return [];
  }

  // Convert to ranges - handle multiple separate ranges correctly
  const ranges: [number, number][] = [];
  let rangeStart = unique[0];
  let rangeEnd = unique[0];

  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === rangeEnd + 1) {
      // Consecutive, extend current range
      rangeEnd = unique[i];
    } else {
      // Gap found, save current range and start new one
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = unique[i];
      rangeEnd = unique[i];
    }
  }
  // Don't forget the last range
  ranges.push([rangeStart, rangeEnd]);

  return ranges;
}

/**
 * Subtracts excluded ranges from a base range, returning the ranges that should be drawn.
 * Similar to how getRowHorizontalRange works.
 */
export function subtractRanges(
  baseRange: [number, number],
  excludedRanges: [number, number][]
): [number, number][] | undefined {
  if (excludedRanges.length === 0) {
    return undefined;
  }

  // Create a list of numbers that need to be excluded
  const excluded: number[] = [];
  for (const [x0, x1] of excludedRanges) {
    for (let x = x0; x <= x1; x++) {
      excluded.push(x);
    }
  }

  // Create a list of numbers that should be drawn
  const drawn: number[] = [];
  for (let i = baseRange[0]; i <= baseRange[1]; i++) {
    if (!excluded.includes(i)) {
      drawn.push(i);
    }
  }

  if (drawn.length === 0) {
    return [];
  }

  // Convert to ranges - handle multiple separate ranges correctly
  const ranges: [number, number][] = [];
  let rangeStart = drawn[0];
  let rangeEnd = drawn[0];

  for (let i = 1; i < drawn.length; i++) {
    if (drawn[i] === rangeEnd + 1) {
      // Consecutive, extend current range
      rangeEnd = drawn[i];
    } else {
      // Gap found, save current range and start new one
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = drawn[i];
      rangeEnd = drawn[i];
    }
  }
  // Don't forget the last range
  ranges.push([rangeStart, rangeEnd]);

  return ranges;
}
