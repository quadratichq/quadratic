import type { Rect } from '@/app/quadratic-core-types';

// calculates the fade alpha for grid when zooming out
export function calculateAlphaForGridLines(scale: number): number {
  return scale < 0.1 ? 0 : scale < 0.6 ? scale * 2 - 0.2 : 1;
}

/**
 * Converts an array of consecutive numbers into ranges.
 * Follows the same pattern as GridOverflowLines.
 */
function numbersToRanges(numbers: number[]): [number, number][] {
  if (numbers.length === 0) {
    return [];
  }

  const results: [number, number][] = [];
  for (let i = 0; i < numbers.length; i++) {
    let start = numbers[i];
    while (i + 1 < numbers.length && numbers[i + 1] - numbers[i] === 1) {
      i++;
    }
    results.push([start, numbers[i]]);
  }
  return results;
}

/**
 * Precalculates which column ranges should be excluded for a given row due to merged cells.
 * Similar to getRowHorizontalRange, but for merged cells.
 * Returns an array of [x0, x1] ranges that should be excluded.
 * Follows the same pattern as GridOverflowLines.
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
  // Create a list of x coordinates that need removing (following GridOverflowLines pattern)
  const excludedColumns: number[] = [];
  const rowBigInt = BigInt(row);

  for (const mergeRect of mergedRects) {
    // Check if row is inside the merged cell
    // The horizontal line is drawn when row = N, but at position of bottom edge of row N-1
    // For merged cell from min.y to max.y (INCLUSIVE):
    //   - When row=min.y: line between min.y-1 and min.y - KEEP (top edge)
    //   - When row=min.y+1: line between min.y and min.y+1 - EXCLUDE
    //   - When row=max.y: line between max.y-1 and max.y - EXCLUDE
    //   - When row=max.y+1: line between max.y and max.y+1 - KEEP (bottom edge)
    const isInside = mergeRect.min.y < rowBigInt && rowBigInt <= mergeRect.max.y;
    if (isInside) {
      // Check if the merged cell's column range overlaps with the visible column range
      const mergedStartCol = Number(mergeRect.min.x);
      const mergedEndCol = Number(mergeRect.max.x);
      // Only exclude columns if there's an overlap
      if (mergedStartCol <= columns[1] && mergedEndCol >= columns[0]) {
        // Add all columns in the merged cell that overlap with the visible range
        const startCol = Math.max(mergedStartCol, columns[0]);
        const endCol = Math.min(mergedEndCol, columns[1]);
        for (let x = startCol; x <= endCol; x++) {
          excludedColumns.push(x);
        }
      }
    }
  }

  if (excludedColumns.length === 0) {
    return [];
  }

  // Convert excluded columns to ranges (following GridOverflowLines pattern)
  // First deduplicate and sort
  const unique = Array.from(new Set(excludedColumns)).sort((a, b) => a - b);
  return numbersToRanges(unique);
}

/**
 * Precalculates which row ranges should be excluded for a given column due to merged cells.
 * Similar to getColumnVerticalRange, but for merged cells.
 * Returns an array of [y0, y1] ranges that should be excluded.
 * Follows the same pattern as GridOverflowLines.
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
  // Create a list of y coordinates that need removing (following GridOverflowLines pattern)
  const excludedRows: number[] = [];
  const colBigInt = BigInt(column);

  for (const mergeRect of mergedRects) {
    // Check if column is inside the merged cell
    // The vertical line is drawn when column = N, but at position of right edge of column N-1
    // For merged cell from min.x to max.x (INCLUSIVE, e.g., D=3 to G=6):
    //   - When column=min.x (e.g., 3=D): line between min.x-1 and min.x (C|D) - KEEP (left edge)
    //   - When column=min.x+1 (e.g., 4=E): line between min.x and min.x+1 (D|E) - EXCLUDE
    //   - When column=max.x (e.g., 6=G): line between max.x-1 and max.x (F|G) - EXCLUDE
    //   - When column=max.x+1 (e.g., 7=H): line between max.x and max.x+1 (G|H) - KEEP (right edge)
    if (colBigInt > mergeRect.min.x && colBigInt <= mergeRect.max.x) {
      // Check if the merged cell's row range overlaps with the visible row range
      const mergedStartRow = Number(mergeRect.min.y);
      const mergedEndRow = Number(mergeRect.max.y);
      // Only exclude rows if there's an overlap
      if (mergedStartRow <= rows[1] && mergedEndRow >= rows[0]) {
        // Add all rows in the merged cell that overlap with the visible range
        const startRow = Math.max(mergedStartRow, rows[0]);
        const endRow = Math.min(mergedEndRow, rows[1]);
        for (let y = startRow; y <= endRow; y++) {
          excludedRows.push(y);
        }
      }
    }
  }

  if (excludedRows.length === 0) {
    return [];
  }

  // Convert excluded rows to ranges (following GridOverflowLines pattern)
  // First deduplicate and sort
  const unique = Array.from(new Set(excludedRows)).sort((a, b) => a - b);
  return numbersToRanges(unique);
}

/**
 * Subtracts excluded ranges from a base range, returning the ranges that should be drawn.
 * Follows the same pattern as GridOverflowLines.getRowHorizontalRange and getColumnVerticalRange.
 */
export function subtractRanges(
  baseRange: [number, number],
  excludedRanges: [number, number][]
): [number, number][] | undefined {
  if (excludedRanges.length === 0) {
    return undefined;
  }

  // Create a set of numbers that need removing (following GridOverflowLines pattern)
  const excludedSet = new Set<number>();
  for (const [x0, x1] of excludedRanges) {
    for (let x = x0; x <= x1; x++) {
      excludedSet.add(x);
    }
  }

  // if there are no gaps, then draw the entire screen
  if (excludedSet.size === 0) {
    return undefined;
  }

  // now create a list of numbers that need to be drawn (following GridOverflowLines pattern)
  const drawnLines: number[] = [];
  for (let i = baseRange[0]; i <= baseRange[1]; i++) {
    if (!excludedSet.has(i)) {
      drawnLines.push(i);
    }
  }

  if (drawnLines.length === 0) {
    return [];
  }

  // finally, create a list of ranges to draw (following GridOverflowLines pattern)
  return numbersToRanges(drawnLines);
}

/**
 * Converts ranges to an array of excluded numbers.
 * Used to extract excluded coordinates from overflow ranges.
 */
function rangesToExcludedNumbers(ranges: [number, number][], baseRange: [number, number]): number[] {
  const excluded: number[] = [];
  const drawnSet = new Set<number>();

  // Add all numbers in the ranges (what IS drawn)
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) {
      drawnSet.add(i);
    }
  }

  // Find what is NOT drawn (excluded)
  for (let i = baseRange[0]; i <= baseRange[1]; i++) {
    if (!drawnSet.has(i)) {
      excluded.push(i);
    }
  }

  return excluded;
}

/**
 * Computes ranges to draw for a horizontal line, combining overflow and merged cell exclusions.
 * Follows the same pattern as GridOverflowLines.getRowHorizontalRange.
 */
export function getRowHorizontalRangesToDraw(
  row: number,
  columns: [number, number],
  overflowRanges: [number, number][] | undefined,
  mergedExcludedCols: [number, number][]
): [number, number][] | undefined {
  const excludedSet = new Set<number>();

  // Extract excluded columns from overflow ranges
  if (overflowRanges) {
    const overflowExcluded = rangesToExcludedNumbers(overflowRanges, columns);
    for (const x of overflowExcluded) {
      excludedSet.add(x);
    }
  }

  // Add merged cell exclusions
  for (const [x0, x1] of mergedExcludedCols) {
    for (let x = x0; x <= x1; x++) {
      excludedSet.add(x);
    }
  }

  // if there are no gaps, then draw the entire screen
  if (excludedSet.size === 0) {
    return undefined;
  }

  // now create a list of numbers that need to be drawn (following GridOverflowLines pattern)
  const drawnLines: number[] = [];
  for (let i = columns[0]; i <= columns[1]; i++) {
    if (!excludedSet.has(i)) {
      drawnLines.push(i);
    }
  }

  if (drawnLines.length === 0) {
    return [];
  }

  // finally, create a list of ranges to draw (following GridOverflowLines pattern)
  return numbersToRanges(drawnLines);
}

/**
 * Computes ranges to draw for a vertical line, combining overflow and merged cell exclusions.
 * Follows the same pattern as GridOverflowLines.getColumnVerticalRange.
 */
export function getColumnVerticalRangesToDraw(
  column: number,
  rows: [number, number],
  overflowRanges: [number, number][] | undefined,
  mergedExcludedRows: [number, number][]
): [number, number][] | undefined {
  const excludedSet = new Set<number>();

  // Extract excluded rows from overflow ranges
  if (overflowRanges) {
    const overflowExcluded = rangesToExcludedNumbers(overflowRanges, rows);
    for (const y of overflowExcluded) {
      excludedSet.add(y);
    }
  }

  // Add merged cell exclusions
  for (const [y0, y1] of mergedExcludedRows) {
    for (let y = y0; y <= y1; y++) {
      excludedSet.add(y);
    }
  }

  // if there are no gaps, then draw the entire screen
  if (excludedSet.size === 0) {
    return undefined;
  }

  // now create a list of numbers that need to be drawn (following GridOverflowLines pattern)
  const drawnLines: number[] = [];
  for (let y = rows[0]; y <= rows[1]; y++) {
    if (!excludedSet.has(y)) {
      drawnLines.push(y);
    }
  }

  if (drawnLines.length === 0) {
    return [];
  }

  // finally, create a list of ranges to draw (following GridOverflowLines pattern)
  return numbersToRanges(drawnLines);
}
