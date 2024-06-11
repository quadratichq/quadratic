import { Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';

export function selectAllCells() {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  // if we've already selected all, then select the content within the sheet
  if (cursor.columnRow?.all) {
    const bounds = sheet.getBounds(true);
    if (bounds) {
      cursor.changePosition({
        multiCursor: [new Rectangle(bounds.left, bounds.top, bounds.right, bounds.bottom)],
        cursorPosition: { x: bounds.left, y: bounds.top },
      });
    } else {
      cursor.changePosition({
        multiCursor: undefined,
        cursorPosition: { x: 0, y: 0 },
      });
    }
  } else {
    cursor.changePosition({ columnRow: { all: true } });
  }
}

// Selects columns. Cursor position is set to the last column selected or the passed column.
export async function selectColumns(columns: number[], column = columns[columns.length - 1]) {
  // remove duplicates
  columns = columns.filter((item, pos) => columns.indexOf(item) === pos);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  if (columns.length === 0) {
    cursor.changePosition({ columnRow: undefined });
    return;
  }

  cursor.changePosition({ columnRow: { columns }, cursorPosition: { x: column, y: cursor.cursorPosition.y } });
}

export async function selectRows(rows: number[], row = rows[rows.length - 1]) {
  // remove duplicates
  rows = rows.filter((item, pos) => rows.indexOf(item) === pos);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  if (rows.length === 0) {
    cursor.changePosition({ columnRow: undefined });
    return;
  }

  cursor.changePosition({ columnRow: { rows }, cursorPosition: { x: cursor.cursorPosition.x, y: row } });
}
