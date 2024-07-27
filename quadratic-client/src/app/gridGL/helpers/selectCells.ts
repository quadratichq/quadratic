import { Rectangle } from 'pixi.js';

import { sheets } from '@/app/grid/controller/Sheets';
import {
  getVisibleLeftColumn,
  getVisibleTopRow,
  isColumnVisible,
  isRowVisible,
} from '@/app/gridGL/interaction/viewportHelper';

export function selectAllCells() {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  // if we've already selected all, then select the content within the sheet
  if (cursor.columnRow?.all) {
    const bounds = sheet.getBounds(true);
    console.log(bounds);
    if (bounds) {
      cursor.changePosition({
        columnRow: null,
        multiCursor: [new Rectangle(bounds.left, bounds.top, bounds.width + 1, bounds.height + 1)],
        cursorPosition: { x: bounds.left, y: bounds.top },
      });
    } else {
      cursor.changePosition({
        columnRow: null,
        multiCursor: null,
        cursorPosition: { x: 0, y: 0 },
      });
    }
  } else {
    cursor.changePosition({ columnRow: { all: true }, multiCursor: null });
  }
}

/**
 * Selects columns. Cursor position is set to the last column selected or the
 * passed column.
 * @param column if column is set, then that column is used as the cursor
 * position, otherwise it uses the last entry in columns
 */
export async function selectColumns(columns: number[], column = columns[columns.length - 1], keepExisting = false) {
  // remove duplicates
  columns = columns.filter((item, pos) => columns.indexOf(item) === pos);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  const multiCursor = keepExisting ? cursor?.multiCursor : null;
  const rows = keepExisting ? cursor.columnRow?.rows : undefined;

  if (columns.length === 0) {
    cursor.changePosition({ columnRow: rows ? { rows } : null, multiCursor });
    return;
  }

  // Find a row to select based on viewport. 1. if 0 is visible, use that; 2. if
  // not use, the first row from the top of the viewport.
  let row: number;
  if (isRowVisible(0)) {
    row = 0;
  } else {
    row = getVisibleTopRow();
  }
  cursor.changePosition({ columnRow: { columns, rows }, cursorPosition: { x: column, y: row }, multiCursor });
}

export async function selectRows(rows: number[], row = rows[rows.length - 1], keepExisting = false) {
  // remove duplicates
  rows = rows.filter((item, pos) => rows.indexOf(item) === pos);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  const multiCursor = keepExisting ? cursor.multiCursor : null;
  const columns = keepExisting ? cursor.columnRow?.columns : undefined;

  if (rows.length === 0) {
    cursor.changePosition({ columnRow: columns ? { columns } : null, multiCursor });
    return;
  }

  // Find a column to select based on viewport. 1. if 0 is visible, use that; 2. if
  // not use, the first column from the left of the viewport.
  let column: number;
  if (isColumnVisible(0)) {
    column = 0;
  } else {
    column = getVisibleLeftColumn();
  }

  cursor.changePosition({ columnRow: { rows, columns }, cursorPosition: { x: column, y: row }, multiCursor });
}
