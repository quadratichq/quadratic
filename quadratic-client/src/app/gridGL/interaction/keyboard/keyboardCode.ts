import { hasPermissionToEditFile } from '@/app/actions';
import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export function keyboardCode(
  event: React.KeyboardEvent<HTMLElement>,
  editorInteractionState: EditorInteractionState
): boolean {
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }
  if (event.code === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (event.shiftKey) {
      if (event.altKey) {
        quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition());
      } else {
        quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
      }
    } else {
      quadraticCore.rerunCodeCells(
        sheets.sheet.id,
        editorInteractionState.selectedCell.x,
        editorInteractionState.selectedCell.y,
        sheets.getCursorPosition()
      );
    }
    return true;
  }

  if (editorInteractionState.showCodeEditor) {
    if (event.code === 'KeyL' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      insertCellRef(editorInteractionState);
    }
  }
  return false;
}
