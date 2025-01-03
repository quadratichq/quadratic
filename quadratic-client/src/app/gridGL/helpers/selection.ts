import { sheets } from '@/app/grid/controller/Sheets';
import { RefRangeBounds } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

// returns rectangle representing the range in col/row coordinates
export function getRangeRectangleFromCellRefRange(range: RefRangeBounds): Rectangle {
  const { col, row } = range.start;
  let startCol = Number(col.coord);
  if (startCol === -1) startCol = 1;
  let startRow = Number(row.coord);
  if (startRow === -1) startRow = 1;

  const end = range.end;
  let endCol = Number(end.col.coord);
  if (endCol === -1) endCol = Infinity;
  let endRow = Number(end.row.coord);
  if (endRow === -1) endRow = Infinity;

  // normalize the coordinates
  const minCol = Math.min(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxCol = Math.max(startCol, endCol);
  const maxRow = Math.max(startRow, endRow);

  return new Rectangle(minCol, minRow, maxCol - minCol + 1, maxRow - minRow + 1);
}

// returns rectangle representing the range in screen coordinates
export function getRangeScreenRectangleFromCellRefRange(range: RefRangeBounds): Rectangle {
  const colRowRect = getRangeRectangleFromCellRefRange(range);

  const sheet = sheets.sheet;
  const { left, top } = sheet.getCellOffsets(colRowRect.left, colRowRect.top);
  let right = Infinity;
  let bottom = Infinity;

  if (colRowRect.right !== Infinity) {
    const { position } = sheet.offsets.getColumnPlacement(colRowRect.right);
    right = position;
  }
  if (colRowRect.bottom !== Infinity) {
    const { position } = sheet.offsets.getRowPlacement(colRowRect.bottom);
    bottom = position;
  }

  const rangeRect = new Rectangle(left, top, right - left, bottom - top);
  return rangeRect;
}
