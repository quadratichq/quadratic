import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '../../grid/controller/Sheets';

export function selectAllCells() {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  if (cursor.columnRow?.all) {
    const bounds = sheet.getBounds(true);
    if (bounds) {
      cursor.changePosition({
        multiCursor: {
          originPosition: { x: bounds.left, y: bounds.top },
          terminalPosition: { x: bounds.right, y: bounds.bottom },
        },
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

export async function selectColumns(start: number, end: number) {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const columnRow = cursor.columnRow;
  if (columnRow?.columns && columnRow.columns[0] === start && columnRow.columns[0] === end) {
    const bounds = await quadraticCore.getColumnsBounds(sheet.id, start, end, true);
    if (bounds) {
      cursor.changePosition({
        cursorPosition: { x: start, y: bounds.min },
        multiCursor: {
          originPosition: { x: Math.min(start, end), y: bounds.min },
          terminalPosition: { x: Math.max(start, end), y: bounds.max },
        },
      });
    } else {
      cursor.changePosition({
        cursorPosition: { x: start, y: 0 },
      });
    }
  } else {
    const columns = Array.from(
      { length: Math.max(start, end) - Math.min(start, end) + 1 },
      (_, i) => Math.min(start, end) + i
    );
    cursor.changePosition({ cursorPosition: { x: start, y: 0 }, columnRow: { columns } });
  }
}

export async function selectRows(start: number, end: number): Promise<void> {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const columnRow = cursor.columnRow;
  if (columnRow?.rows && columnRow.rows[0] === start && columnRow.rows[0] === end) {
    const bounds = await quadraticCore.getRowsBounds(sheet.id, start, end, true);
    if (bounds) {
      sheet.cursor.changePosition({
        cursorPosition: { x: bounds.min, y: start },
        multiCursor: {
          originPosition: { x: bounds.min, y: Math.min(start, end) },
          terminalPosition: { x: bounds.max, y: Math.max(start, end) },
        },
      });
    } else {
      sheet.cursor.changePosition({
        cursorPosition: { x: 0, y: start },
      });
    }
  } else {
    const rows = Array.from(
      { length: Math.max(start, end) - Math.min(start, end) + 1 },
      (_, i) => Math.min(start, end) + i
    );
    cursor.changePosition({ cursorPosition: { x: 0, y: start }, columnRow: { rows } });
  }
}
