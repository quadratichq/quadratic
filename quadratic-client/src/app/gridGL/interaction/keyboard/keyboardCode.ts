import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export function keyboardCode(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { editorInteractionState, codeEditorState } = pixiAppSettings;
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }

  // Execute code cell
  if (matchShortcut(Action.ExecuteCode, event)) {
    quadraticCore.rerunCodeCells(
      sheets.sheet.id,
      sheets.sheet.cursor.position.x,
      sheets.sheet.cursor.position.y,
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
  if (codeEditorState.showCodeEditor && matchShortcut(Action.InsertCellReference, event)) {
    const { sheetId, pos, language } = codeEditorState.codeCell;
    insertCellRef(pos, sheetId, language);
    return true;
  }

  return false;
}
