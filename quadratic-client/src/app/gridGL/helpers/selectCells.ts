import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
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

export async function selectColumns(columns: number[]) {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const columnRow = cursor.columnRow;

  // if second selection of same [column] then select content within column
  if (columnRow?.columns && columnRow.columns.length === 1 && columnRow.columns[0] === columns[0]) {
    const bounds = await quadraticCore.getColumnsBounds(sheet.id, columns[0], columns[0], true);
    if (bounds) {
      cursor.changePosition({
        cursorPosition: { x: columns[0], y: bounds.min },
        multiCursor: [new Rectangle(columns[0], bounds.min, columns[0], bounds.max)],
      });
    } else {
      cursor.changePosition({
        cursorPosition: { x: columns[0], y: 0 },
      });
    }
  } else {
    cursor.changePosition({ columnRow: { columns }, cursorPosition: { x: columns[0], y: cursor.cursorPosition.y } });
  }
}

export async function selectRows(rows: number[]): Promise<void> {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const columnRow = cursor.columnRow;

  // if second selection of same [row] then select content within row
  if (columnRow?.rows && columnRow.rows[0] === rows[0] && columnRow.rows[0] === rows[0]) {
    const bounds = await quadraticCore.getRowsBounds(sheet.id, rows[0], rows[0], true);
    if (bounds) {
      sheet.cursor.changePosition({
        cursorPosition: { x: bounds.min, y: rows[0] },
        multiCursor: [new Rectangle(bounds.min, rows[0], bounds.max, rows[0])],
      });
    } else {
      sheet.cursor.changePosition({
        cursorPosition: { x: 0, y: rows[0] },
      });
    }
  } else {
    cursor.changePosition({ columnRow: { rows }, cursorPosition: { x: cursor.cursorPosition.x, y: rows[0] } });
  }
}
