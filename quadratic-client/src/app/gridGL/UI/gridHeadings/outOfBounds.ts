import { sheets } from '@/app/grid/controller/Sheets';

// determine the horizontal out of bounds based on sheet's visibleBounds
// @right the visible bounds to the right -- skips check if not provided
export function outOfBoundsRight(right?: number): number | undefined {
  const offsets = sheets.sheet.offsets;
  const sheetSize = sheets.sheet.sheetSize;
  let outOfBounds = sheetSize ? offsets.getColumnPlacement(Number(sheetSize[0]) + 1).position : undefined;
  if (right !== undefined && outOfBounds !== undefined && outOfBounds > right) {
    outOfBounds = undefined;
  }

  return outOfBounds;
}

// determine the vertical out of bounds based on sheet's visibleBounds
// @bottom the visible bounds to the bottom -- skips check if not provided
export function outOfBoundsBottom(bottom?: number): number | undefined {
  const offsets = sheets.sheet.offsets;
  const sheetSize = sheets.sheet.sheetSize;
  let outOfBounds = sheetSize ? offsets.getRowPlacement(Number(sheetSize[1]) + 1).position : undefined;
  if (bottom !== undefined && outOfBounds !== undefined && outOfBounds > bottom) {
    outOfBounds = undefined;
  }

  return outOfBounds;
}
