import { sheets } from '@/app/grid/controller/Sheets';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

// returns rectangle representing the range in col/row coordinates
export function getRangeRectangleFromCellRefRange({ range }: CellRefRange): Rectangle {
  const { col, row } = range.start;
  const startCol = Number(col?.coord ?? 1);
  const startRow = Number(row?.coord ?? 1);

  const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;
  let endCol = Number(end?.col?.coord ?? Infinity);
  let endRow = Number(end?.row?.coord ?? Infinity);

  if (!end) {
    if (col && col.coord !== undefined) {
      endCol = startCol;
    }
    if (row && row.coord !== undefined) {
      endRow = startRow;
    }
  }

  // normalize the coordinates
  const minCol = Math.min(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxCol = Math.max(startCol, endCol);
  const maxRow = Math.max(startRow, endRow);

  return new Rectangle(minCol, minRow, maxCol - minCol + 1, maxRow - minRow + 1);
}

// returns rectangle representing the range in screen coordinates
export function getRangeScreenRectangleFromCellRefRange(range: CellRefRange): Rectangle {
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
