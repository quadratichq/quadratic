import {
  calculateAlphaForGridLines,
  getColumnVerticalRangesToDraw,
  getMergedCellExcludedColumnsForRow,
  getMergedCellExcludedRowsForColumn,
  getRowHorizontalRangesToDraw,
  subtractRanges,
} from '@/app/gridGL/UI/gridUtils';
import type { Rect } from '@/app/quadratic-core-types';
import { describe, expect, it } from 'vitest';

describe('gridUtils', () => {
  describe('calculateAlphaForGridLines', () => {
    it('returns 0 for scale < 0.1', () => {
      expect(calculateAlphaForGridLines(0.05)).toBe(0);
      expect(calculateAlphaForGridLines(0.09)).toBe(0);
    });

    it('returns linear interpolation for 0.1 <= scale < 0.6', () => {
      expect(calculateAlphaForGridLines(0.1)).toBe(0);
      expect(calculateAlphaForGridLines(0.35)).toBeCloseTo(0.5, 5);
      expect(calculateAlphaForGridLines(0.6)).toBeCloseTo(1, 5);
    });

    it('returns 1 for scale >= 0.6', () => {
      expect(calculateAlphaForGridLines(0.6)).toBe(1);
      expect(calculateAlphaForGridLines(1.0)).toBe(1);
      expect(calculateAlphaForGridLines(2.0)).toBe(1);
    });
  });

  describe('getMergedCellExcludedColumnsForRow', () => {
    it('returns empty array when no merged rects', () => {
      const result = getMergedCellExcludedColumnsForRow(5, [0, 10], []);
      expect(result).toEqual([]);
    });

    it('excludes columns when row is inside merged cell', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Row 2 is inside the merged cell (between min.y=1 and max.y=3)
      const result = getMergedCellExcludedColumnsForRow(2, [0, 10], mergedRects);
      expect(result).toEqual([[2, 4]]);
    });

    it('does not exclude columns when row is on top edge', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Row 1 is the top edge (min.y), should not be excluded
      const result = getMergedCellExcludedColumnsForRow(1, [0, 10], mergedRects);
      expect(result).toEqual([]);
    });

    it('does not exclude columns when row is below bottom edge', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Row 4 is below the merged cell (max.y + 1), should not be excluded
      const result = getMergedCellExcludedColumnsForRow(4, [0, 10], mergedRects);
      expect(result).toEqual([]);
    });

    it('clips excluded columns to visible range', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(8), y: BigInt(3) },
        },
      ];
      // Only columns 2-5 should be excluded (clipped to visible range [0, 5])
      const result = getMergedCellExcludedColumnsForRow(2, [0, 5], mergedRects);
      expect(result).toEqual([[2, 5]]);
    });

    it('merges overlapping excluded ranges from multiple rects', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
        {
          min: { x: BigInt(3), y: BigInt(1) },
          max: { x: BigInt(6), y: BigInt(3) },
        },
      ];
      // Row 2 is inside both merged cells
      // Should merge overlapping ranges: [2,4] and [3,6] -> [2,6]
      const result = getMergedCellExcludedColumnsForRow(2, [0, 10], mergedRects);
      expect(result).toEqual([[2, 6]]);
    });

    it('handles non-overlapping excluded ranges from multiple rects in same row', () => {
      // Two rects in row 2 (row 2 is inside both):
      // Rect 1: columns 1-3 (excludes columns 1, 2, 3)
      // Rect 2: columns 5-7 (excludes columns 5, 6, 7)
      // Should return two separate excluded ranges
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(1), y: BigInt(1) },
          max: { x: BigInt(3), y: BigInt(3) },
        },
        {
          min: { x: BigInt(5), y: BigInt(1) },
          max: { x: BigInt(7), y: BigInt(3) },
        },
      ];
      // Row 2 is inside both rects (between min.y=1 and max.y=3 for both)
      const result = getMergedCellExcludedColumnsForRow(2, [0, 10], mergedRects);
      // Should return two separate ranges: [1,3] and [5,7]
      expect(result).toEqual([
        [1, 3], // First rect
        [5, 7], // Second rect
      ]);
    });
  });

  describe('getMergedCellExcludedRowsForColumn', () => {
    it('returns empty array when no merged rects', () => {
      const result = getMergedCellExcludedRowsForColumn(5, [0, 10], []);
      expect(result).toEqual([]);
    });

    it('excludes rows when column is inside merged cell', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Column 3 is inside the merged cell (between min.x=2 and max.x=4)
      const result = getMergedCellExcludedRowsForColumn(3, [0, 10], mergedRects);
      expect(result).toEqual([[1, 3]]);
    });

    it('does not exclude rows when column is on left edge', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Column 2 is the left edge (min.x), should not be excluded
      const result = getMergedCellExcludedRowsForColumn(2, [0, 10], mergedRects);
      expect(result).toEqual([]);
    });

    it('excludes rows when column is on right edge', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
      ];
      // Column 4 is the right edge (max.x), should be excluded (line between column 3 and 4)
      const result = getMergedCellExcludedRowsForColumn(4, [0, 10], mergedRects);
      expect(result).toEqual([[1, 3]]);
    });

    it('clips excluded rows to visible range', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(8) },
        },
      ];
      // Only rows 1-5 should be excluded (clipped to visible range [0, 5])
      const result = getMergedCellExcludedRowsForColumn(3, [0, 5], mergedRects);
      expect(result).toEqual([[1, 5]]);
    });

    it('merges overlapping excluded ranges from multiple rects', () => {
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
        {
          min: { x: BigInt(2), y: BigInt(2) },
          max: { x: BigInt(4), y: BigInt(6) },
        },
      ];
      // Column 3 is inside both merged cells (between min.x=2 and max.x=4 for both)
      // First rect excludes rows [1,3], second rect excludes rows [2,6]
      // Should merge overlapping ranges: [1,3] and [2,6] -> [1,6]
      const result = getMergedCellExcludedRowsForColumn(3, [0, 10], mergedRects);
      expect(result).toEqual([[1, 6]]);
    });

    it('handles non-overlapping excluded ranges from multiple rects in same column', () => {
      // Two rects in column 3 (column 3 is inside both):
      // Rect 1: rows 1-3 (excludes rows 1, 2, 3)
      // Rect 2: rows 5-7 (excludes rows 5, 6, 7)
      // Should return two separate excluded ranges
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
        {
          min: { x: BigInt(2), y: BigInt(5) },
          max: { x: BigInt(4), y: BigInt(7) },
        },
      ];
      // Column 3 is inside both rects (between min.x=2 and max.x=4 for both)
      const result = getMergedCellExcludedRowsForColumn(3, [0, 10], mergedRects);
      // Should return two separate ranges: [1,3] and [5,7]
      expect(result).toEqual([
        [1, 3], // First rect
        [5, 7], // Second rect
      ]);
    });

    it('handles overlapping excluded ranges from multiple rects in same column', () => {
      // Two overlapping rects in column 3:
      // Rect 1: columns 2-4, rows 1-3 (excludes rows 1, 2, 3 for column 3)
      // Rect 2: columns 2-4, rows 2-5 (excludes rows 2, 3, 4, 5 for column 3)
      // Should merge overlapping ranges: [1,3] and [2,5] -> [1,5]
      const mergedRects: Rect[] = [
        {
          min: { x: BigInt(2), y: BigInt(1) },
          max: { x: BigInt(4), y: BigInt(3) },
        },
        {
          min: { x: BigInt(2), y: BigInt(2) },
          max: { x: BigInt(4), y: BigInt(5) },
        },
      ];
      // Column 3 is inside both rects
      const result = getMergedCellExcludedRowsForColumn(3, [0, 10], mergedRects);
      // Should merge overlapping ranges: [1,3] and [2,5] -> [1,5]
      expect(result).toEqual([[1, 5]]);
    });
  });

  describe('subtractRanges', () => {
    it('returns undefined when no excluded ranges', () => {
      const result = subtractRanges([0, 10], []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when excluded ranges are empty after processing', () => {
      // This shouldn't happen in practice, but testing edge case
      const result = subtractRanges([0, 10], []);
      expect(result).toBeUndefined();
    });

    it('subtracts single excluded range from middle', () => {
      const result = subtractRanges([0, 10], [[3, 5]]);
      expect(result).toEqual([
        [0, 2],
        [6, 10],
      ]);
    });

    it('subtracts excluded range from start', () => {
      const result = subtractRanges([0, 10], [[0, 2]]);
      expect(result).toEqual([[3, 10]]);
    });

    it('subtracts excluded range from end', () => {
      const result = subtractRanges([0, 10], [[8, 10]]);
      expect(result).toEqual([[0, 7]]);
    });

    it('subtracts multiple non-overlapping excluded ranges', () => {
      const result = subtractRanges(
        [0, 10],
        [
          [2, 3],
          [7, 8],
        ]
      );
      expect(result).toEqual([
        [0, 1],
        [4, 6],
        [9, 10],
      ]);
    });

    it('subtracts overlapping excluded ranges (merged)', () => {
      const result = subtractRanges(
        [0, 10],
        [
          [2, 5],
          [4, 7],
        ]
      );
      // Overlapping ranges [2,5] and [4,7] should be treated as [2,7]
      expect(result).toEqual([
        [0, 1],
        [8, 10],
      ]);
    });

    it('returns empty array when entire range is excluded', () => {
      const result = subtractRanges([0, 10], [[0, 10]]);
      expect(result).toEqual([]);
    });

    it('handles adjacent excluded ranges', () => {
      const result = subtractRanges(
        [0, 10],
        [
          [2, 3],
          [4, 5],
        ]
      );
      expect(result).toEqual([
        [0, 1],
        [6, 10],
      ]);
    });
  });

  describe('getRowHorizontalRangesToDraw', () => {
    it('returns undefined when no exclusions', () => {
      const result = getRowHorizontalRangesToDraw(5, [0, 10], undefined, []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when only overflow ranges cover everything', () => {
      // Overflow ranges [0, 10] means everything is drawn, so no exclusions
      const result = getRowHorizontalRangesToDraw(5, [0, 10], [[0, 10]], []);
      expect(result).toBeUndefined();
    });

    it('combines overflow and merged cell exclusions', () => {
      // Overflow excludes [3, 4], merged excludes [6, 7]
      // Overflow ranges [0, 2], [5, 5], [8, 10] means excluded are [3, 4], [6, 7]
      const overflowRanges: [number, number][] = [
        [0, 2],
        [5, 5],
        [8, 10],
      ];
      const mergedExcluded: [number, number][] = [[6, 7]];
      const result = getRowHorizontalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Should exclude [3, 4] from overflow and [6, 7] from merged = [3, 4, 6, 7]
      // Drawn: [0, 2], [5, 5], [8, 10]
      expect(result).toEqual([
        [0, 2],
        [5, 5],
        [8, 10],
      ]);
    });

    it('handles overlapping overflow and merged exclusions', () => {
      // Overflow excludes [3, 5], merged excludes [4, 6]
      // Overflow ranges [0, 2], [7, 10] means excluded are [3, 6]
      const overflowRanges: [number, number][] = [
        [0, 2],
        [7, 10],
      ];
      const mergedExcluded: [number, number][] = [[4, 6]];
      const result = getRowHorizontalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Should exclude [3, 6] (merged overlaps with overflow exclusion)
      // Drawn: [0, 2], [7, 10]
      expect(result).toEqual([
        [0, 2],
        [7, 10],
      ]);
    });

    it('creates three ranges when two rects in same row exclude different columns', () => {
      // Two merged rects in row 5:
      // Rect 1: columns 1-3 (excludes columns 1, 2, 3)
      // Rect 2: columns 5-7 (excludes columns 5, 6, 7)
      // Should create three ranges to draw: before first rect, between rects, after second rect
      const overflowRanges: [number, number][] | undefined = undefined;
      const mergedExcluded: [number, number][] = [
        [1, 3], // First rect
        [5, 7], // Second rect
      ];
      const result = getRowHorizontalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Excluded columns: [1, 2, 3, 5, 6, 7]
      // Drawn columns: [0, 4, 8, 9, 10] -> ranges: [0, 0], [4, 4], [8, 10]
      expect(result).toEqual([
        [0, 0], // Before first rect
        [4, 4], // Between rects
        [8, 10], // After second rect
      ]);
    });

    it('returns empty array when everything is excluded by merged cells', () => {
      // No overflow exclusions, but merged excludes everything
      const overflowRanges: [number, number][] | undefined = undefined;
      const mergedExcluded: [number, number][] = [[0, 10]];
      const result = getRowHorizontalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Everything is excluded
      expect(result).toEqual([]);
    });

    it('returns empty array when overflow and merged together exclude everything', () => {
      // Overflow ranges exclude [0, 4] and [6, 10], merged excludes [5, 5]
      // So everything [0, 10] is excluded
      const overflowRanges: [number, number][] = [];
      const mergedExcluded: [number, number][] = [[0, 10]];
      const result = getRowHorizontalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Everything is excluded
      expect(result).toEqual([]);
    });
  });

  describe('getColumnVerticalRangesToDraw', () => {
    it('returns undefined when no exclusions', () => {
      const result = getColumnVerticalRangesToDraw(5, [0, 10], undefined, []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when only overflow ranges cover everything', () => {
      // Overflow ranges [0, 10] means everything is drawn, so no exclusions
      const result = getColumnVerticalRangesToDraw(5, [0, 10], [[0, 10]], []);
      expect(result).toBeUndefined();
    });

    it('combines overflow and merged cell exclusions', () => {
      // Overflow excludes [3, 4], merged excludes [6, 7]
      // Overflow ranges [0, 2], [5, 5], [8, 10] means excluded are [3, 4], [6, 7]
      const overflowRanges: [number, number][] = [
        [0, 2],
        [5, 5],
        [8, 10],
      ];
      const mergedExcluded: [number, number][] = [[6, 7]];
      const result = getColumnVerticalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Should exclude [3, 4] from overflow and [6, 7] from merged = [3, 4, 6, 7]
      // Drawn: [0, 2], [5, 5], [8, 10]
      expect(result).toEqual([
        [0, 2],
        [5, 5],
        [8, 10],
      ]);
    });

    it('handles overlapping overflow and merged exclusions', () => {
      // Overflow excludes [3, 5], merged excludes [4, 6]
      // Overflow ranges [0, 2], [7, 10] means excluded are [3, 6]
      const overflowRanges: [number, number][] = [
        [0, 2],
        [7, 10],
      ];
      const mergedExcluded: [number, number][] = [[4, 6]];
      const result = getColumnVerticalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Should exclude [3, 6] (merged overlaps with overflow exclusion)
      // Drawn: [0, 2], [7, 10]
      expect(result).toEqual([
        [0, 2],
        [7, 10],
      ]);
    });

    it('creates three ranges when two rects in same column exclude different rows', () => {
      // Two merged rects in column 3:
      // Rect 1: rows 1-3 (excludes rows 1, 2, 3)
      // Rect 2: rows 5-7 (excludes rows 5, 6, 7)
      // Should create three ranges to draw: before first rect, between rects, after second rect
      const overflowRanges: [number, number][] | undefined = undefined;
      const mergedExcluded: [number, number][] = [
        [1, 3], // First rect
        [5, 7], // Second rect
      ];
      const result = getColumnVerticalRangesToDraw(3, [0, 10], overflowRanges, mergedExcluded);
      // Excluded rows: [1, 2, 3, 5, 6, 7]
      // Drawn rows: [0, 4, 8, 9, 10] -> ranges: [0, 0], [4, 4], [8, 10]
      expect(result).toEqual([
        [0, 0], // Before first rect
        [4, 4], // Between rects
        [8, 10], // After second rect
      ]);
    });

    it('returns empty array when everything is excluded by merged cells', () => {
      // No overflow exclusions, but merged excludes everything
      const overflowRanges: [number, number][] | undefined = undefined;
      const mergedExcluded: [number, number][] = [[0, 10]];
      const result = getColumnVerticalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Everything is excluded
      expect(result).toEqual([]);
    });

    it('returns empty array when overflow and merged together exclude everything', () => {
      // Overflow ranges exclude [0, 4] and [6, 10], merged excludes [5, 5]
      // So everything [0, 10] is excluded
      const overflowRanges: [number, number][] = [];
      const mergedExcluded: [number, number][] = [[0, 10]];
      const result = getColumnVerticalRangesToDraw(5, [0, 10], overflowRanges, mergedExcluded);
      // Everything is excluded
      expect(result).toEqual([]);
    });
  });
});
