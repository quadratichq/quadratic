import { sheets } from '@/app/grid/controller/Sheets.js';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';

export function keyboardSelect(event: React.KeyboardEvent<HTMLElement>): boolean {
  const key = event.key.toLowerCase();
  // Command + A -> Select all cells
  if ((event.metaKey || event.ctrlKey) && (key === 'a' || (event.shiftKey && key === ' '))) {
    selectAllCells();
    return true;
  }

  // Command + Space -> Select column
  if ((event.metaKey || event.ctrlKey) && key === ' ') {
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

  // Shift + Space -> Select row
  if (event.shiftKey && key === ' ') {
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
