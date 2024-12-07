import { sheets } from '@/app/grid/controller/Sheets';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

export function getRangeScreenRectangleFromCellRefRange({ range }: CellRefRange): Rectangle {
  const { col, row } = range.start;
  const startCol = Number(col?.coord ?? 1);
  const startRow = Number(row?.coord ?? 1);

  const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;
  const endCol = Number(end?.col?.coord ?? Infinity);
  const endRow = Number(end?.row?.coord ?? Infinity);

  // normalize the coordinates
  const minCol = Math.min(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxCol = Math.max(startCol, endCol);
  const maxRow = Math.max(startRow, endRow);

  const sheet = sheets.sheet;
  const startRect = sheet.getCellOffsets(minCol, minRow);
  const left = startRect.left;
  const top = startRect.top;
  let right = Infinity;
  let bottom = Infinity;

  // calculate the right and bottom edges
  if (end) {
    if (end.col) {
      const { position, size } = sheet.offsets.getColumnPlacement(maxCol);
      right = position + size;
    }
    if (end.row) {
      const { position, size } = sheet.offsets.getRowPlacement(maxRow);
      bottom = position + size;
    }
  } else {
    if (col && col.coord) {
      right = startRect.right;
    }
    if (row) {
      bottom = startRect.bottom;
    }
  }

  const rangeRect = new Rectangle(left, top, right - left, bottom - top);
  return rangeRect;
}
