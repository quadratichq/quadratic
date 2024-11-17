import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets.js';
import { selectAllCells, selectColumns, selectRows } from '@/app/gridGL/helpers/selectCells';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardSelect(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Select all
  if (matchShortcut(Action.SelectAll, event)) {
    selectAllCells();
    return true;
  }

  // Select column
  if (matchShortcut(Action.SelectColumn, event)) {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.rows?.length) {
      selectAllCells();
    } else {
      let columns = new Set<number>(cursor.columnRow?.columns);
      columns.add(cursor.position.x);
      cursor.multiCursor?.forEach((rect) => {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          columns.add(x);
        }
      });
      selectColumns(Array.from(columns), cursor.position.x);
    }
    return true;
  }

  // Select row
  if (matchShortcut(Action.SelectRow, event)) {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.columns?.length) {
      selectAllCells();
    } else {
      let row = new Set<number>(cursor.columnRow?.rows);
      row.add(cursor.position.y);
      cursor.multiCursor?.forEach((rect) => {
        for (let y = rect.y; y < rect.y + rect.height; y++) {
          row.add(y);
        }
      });
      selectRows(Array.from(row), cursor.position.y);
    }
    return true;
  }

  return false;
}
