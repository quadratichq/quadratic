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

  return false;
}
