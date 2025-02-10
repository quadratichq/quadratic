import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { executeCode, rerunAllCode, rerunSheetCode } from '@/app/actions/codeActionsSpec';
import { insertCellReference } from '@/app/actions/insertActionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardCode(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { editorInteractionState, codeEditorState } = pixiAppSettings;
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }

  // Execute code cell
  if (matchShortcut(Action.ExecuteCode, event)) {
    executeCode();
    return true;
  }

  // Rerun sheet code
  if (matchShortcut(Action.RerunSheetCode, event)) {
    rerunSheetCode();
    return true;
  }

  // Rerun all code
  if (matchShortcut(Action.RerunAllCode, event)) {
    rerunAllCode();
    return true;
  }

  // Insert cell reference
  if (codeEditorState.showCodeEditor && matchShortcut(Action.InsertCellReference, event)) {
    insertCellReference();
    return true;
  }

  return false;
}
