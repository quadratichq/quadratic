import { sheets } from '@/app/grid/controller/Sheets';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

export function getRangeScreenRectangleFromCellRefRange({ range }: CellRefRange): Rectangle {
  const sheet = sheets.sheet;

  const { col, row } = range.start;
  const startRect = sheet.getCellOffsets(col?.coord ?? 1, row?.coord ?? 1);
  const startX = startRect.left;
  const startY = startRect.top;

  const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;
  let endX = Infinity;
  let endY = Infinity;
  if (end) {
    if (end.col) {
      const { position, size } = sheet.offsets.getColumnPlacement(Number(end.col.coord));
      endX = position + size;
    }
    if (end.row) {
      const { position, size } = sheet.offsets.getRowPlacement(Number(end.row.coord));
      endY = position + size;
    }
  } else {
    if (col && col.coord) {
      endX = startRect.right;
    }
    if (row) {
      endY = startRect.bottom;
    }
  }

  const rangeRect = new Rectangle(startX, startY, endX - startX, endY - startY);
  return rangeRect;
}
