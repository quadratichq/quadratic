import { sheets } from '@/app/grid/controller/Sheets';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';

export function keyboardCode(
  event: React.KeyboardEvent<HTMLElement>,
  editorInteractionState: EditorInteractionState
): boolean {
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }
  // Execute code cell
  if (matchShortcut('execute_code', event)) {
    console.log();
    quadraticCore.rerunCodeCells(
      sheets.sheet.id,
      sheets.sheet.cursor.cursorPosition.x,
      sheets.sheet.cursor.cursorPosition.y,
      sheets.getCursorPosition()
    );
    return true;
  }

  // Rerun sheet code
  if (matchShortcut('rerun_sheet_code', event)) {
    quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition());
    return true;
  }

  // Rerun all code
  if (matchShortcut('rerun_all_code', event)) {
    quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
    return true;
  }

  // Insert cell reference
  if (editorInteractionState.showCodeEditor && matchShortcut('insert_cell_reference', event)) {
    insertCellRef(editorInteractionState);
    return true;
  }

  return false;
}
