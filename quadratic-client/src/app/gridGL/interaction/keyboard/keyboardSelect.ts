import { sheets } from '@/app/grid/controller/Sheets.js';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';

export function keyboardSelect(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Select all
  if (matchShortcut('select_all', event)) {
    selectAllCells();
    return true;
  }

  // Select column
  if (matchShortcut('select_column', event)) {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.rows?.length) {
      selectAllCells();
    } else {
      let columns = new Set<number>(cursor.columnRow?.columns);
      columns.add(cursor.cursorPosition.x);
      cursor.multiCursor?.forEach((rect) => {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          columns.add(x);
        }
      });
      selectColumns(Array.from(columns), cursor.cursorPosition.x);
    }
    return true;
  }

  // Select row
  if (matchShortcut('select_row', event)) {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.columns?.length) {
      selectAllCells();
    } else {
      let row = new Set<number>(cursor.columnRow?.rows);
      row.add(cursor.cursorPosition.y);
      cursor.multiCursor?.forEach((rect) => {
        for (let y = rect.y; y < rect.y + rect.height; y++) {
          row.add(y);
        }
      });
      selectRows(Array.from(row), cursor.cursorPosition.y);
    }
    return true;
  }

  return false;
}
