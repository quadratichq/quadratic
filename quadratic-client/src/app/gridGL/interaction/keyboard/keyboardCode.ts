import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export function keyboardCode(
  event: React.KeyboardEvent<HTMLElement>,
  editorInteractionState: EditorInteractionState
): boolean {
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }
  // Execute code cell
  if (matchShortcut(Action.ExecuteCode, event)) {
    quadraticCore.rerunCodeCells(
      sheets.sheet.id,
      sheets.sheet.cursor.cursorPosition.x,
      sheets.sheet.cursor.cursorPosition.y,
      sheets.getCursorPosition()
    );
    return true;
  }

  // Rerun sheet code
  if (matchShortcut(Action.RerunSheetCode, event)) {
    quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition());
    return true;
  }

  // Rerun all code
  if (matchShortcut(Action.RerunAllCode, event)) {
    quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
    return true;
  }

  // Insert cell reference
  if (editorInteractionState.showCodeEditor && matchShortcut(Action.InsertCellReference, event)) {
    const { selectedCell, selectedCellSheet, mode } = editorInteractionState;
    insertCellRef(selectedCell, selectedCellSheet, mode);
    return true;
  }

  return false;
}
