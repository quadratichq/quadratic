import { Selection } from '@/app/quadratic-core-types';
import { SheetCursor } from './SheetCursor';

const RANGE_SEPARATOR = '; ';

export const getSelectionRange = (cursor: SheetCursor): string => {
  let range = '';
  if (cursor.columnRow) {
    if (cursor.columnRow.all) {
      return 'all';
    }
    if (cursor.columnRow.columns) {
      if (range) {
        range += RANGE_SEPARATOR;
      }
      range += `(col=${cursor.columnRow.columns.join(', ')})`;
    }
    if (cursor.columnRow.rows) {
      if (range) {
        range += RANGE_SEPARATOR;
      }
      range += `(row=${cursor.columnRow.rows.join(', ')})`;
    }
  }

  if (cursor.multiCursor) {
    if (range) {
      range += RANGE_SEPARATOR;
    }
    range += cursor.multiCursor
      .map((rect) => {
        if (rect.width === 1 && rect.height === 1) {
          return `(${rect.x},${rect.y})`;
        }
        return `(${rect.x},${rect.y})-(${rect.x + rect.width - 1},${rect.y + rect.height - 1})`;
      })
      .join(RANGE_SEPARATOR);
  }

  if (!range) {
    range += `(${cursor.cursorPosition.x},${cursor.cursorPosition.y})`;
  }
  return range;
};

export const getSingleSelection = (sheetId: string, x: number, y: number): Selection => {
  return {
    sheet_id: { id: sheetId },
    x: BigInt(x),
    y: BigInt(y),
    columns: null,
    rows: null,
    rects: [{ min: { x: BigInt(x), y: BigInt(y) }, max: { x: BigInt(x), y: BigInt(y) } }],
    all: false,
  };
};
