import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets.js';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardSelect(event: React.KeyboardEvent<HTMLElement>): boolean {
  const cursor = sheets.sheet.cursor;

  // Select all
  if (matchShortcut(Action.SelectAll, event)) {
    cursor.selectAll();
    return true;
  }

  // Select column
  if (matchShortcut(Action.SelectColumn, event)) {
    cursor.setColumnsSelected();
    return true;
  }

  // Select row
  if (matchShortcut(Action.SelectRow, event)) {
    cursor.setRowsSelected();
    return true;
  }

  // Select page down
  if (matchShortcut(Action.SelectPageDown, event)) {
    cursor.selectPageDown();
    return true;
  }

  // Select page up
  if (matchShortcut(Action.SelectPageUp, event)) {
    cursor.selectPageUp();
    return true;
  }

  // Select goto row start
  if (matchShortcut(Action.SelectGotoRowStart, event)) {
    const row = cursor.selectionEnd.y;
    cursor.selectTo(1, row, false, true);
    return true;
  }

  // Select goto row end
  if (matchShortcut(Action.SelectGotoRowEnd, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    const right = bounds?.right ?? 1;
    const row = cursor.selectionEnd.y;
    cursor.selectTo(right, row, false, true);
    return true;
  }

  return false;
}
