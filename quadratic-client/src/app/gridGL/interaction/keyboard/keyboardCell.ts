import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { doubleClickCell } from '../pointer/doubleClickCell';
import { isAllowedFirstChar } from './keyboardCellChars';

function inCodeEditor(editorInteractionState: EditorInteractionState, cursor: SheetCursor): boolean {
  if (!editorInteractionState.showCodeEditor) return false;
  const cursorPosition = cursor.cursorPosition;
  const selectedX = editorInteractionState.selectedCell.x;
  const selectedY = editorInteractionState.selectedCell.y;

  // selectedCell is inside single cursor
  if (selectedX === cursorPosition.x && selectedY === cursorPosition.y) {
    return true;
  }

  // selectedCell is inside multi-cursor
  if (cursor.multiCursor?.some((cursor) => cursor.contains(selectedX, selectedY))) {
    return true;
  }
  return false;
}

export async function keyboardCell(options: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}): Promise<boolean> {
  const { event, editorInteractionState, setEditorInteractionState } = options;

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

  const hasPermission = hasPermissionToEditFile(editorInteractionState.permissions);

  if (event.key === 'Tab') {
    // move single cursor one right
    event.preventDefault();
    const delta = event.shiftKey ? -1 : 1;
    cursor.changePosition({
      keyboardMovePosition: {
        x: cursorPosition.x + delta,
        y: cursorPosition.y,
      },
      cursorPosition: {
        x: cursorPosition.x + delta,
        y: cursorPosition.y,
      },
    });
  }

  if (event.key === 'Enter') {
    if (!inlineEditorHandler.isEditingFormula()) {
      event.preventDefault();
      const column = cursorPosition.x;
      const row = cursorPosition.y;
      const code = await quadraticCore.getCodeCell(sheets.sheet.id, column, row);
      if (code) {
        doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
      } else {
        const cell = await quadraticCore.getEditCell(sheets.sheet.id, column, row);
        doubleClickCell({ column, row, cell });
      }
    }
  }

  // Don't allow actions beyond here for certain users
  if (!hasPermission) {
    return false;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    if (inCodeEditor(editorInteractionState, cursor)) {
      if (!pixiAppSettings.unsavedEditorChanges) {
        setEditorInteractionState((state) => ({
          ...state,
          waitingForEditorClose: undefined,
          showCodeEditor: false,
          mode: undefined,
        }));
      } else {
        pixiAppSettings.addGlobalSnackbar?.('You can not delete a code cell with unsaved changes', {
          severity: 'warning',
        });
        return true;
      }
    }
    // delete a range or a single cell, depending on if MultiCursor is active
    quadraticCore.deleteCellValues(sheets.getRustSelection(), sheets.getCursorPosition());
  }

  if (event.key === '/') {
    event.preventDefault();
    openCodeEditor();
  }

  if (isAllowedFirstChar(event.key)) {
    event.preventDefault();
    const cursorPosition = cursor.cursorPosition;
    const code = await quadraticCore.getCodeCell(sheets.sheet.id, cursorPosition.x, cursorPosition.y);

    // open code cell unless this is the actual code cell. In this case we can overwrite it
    if (code && (Number(code.x) !== cursorPosition.x || Number(code.y) !== cursorPosition.y)) {
      doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
    } else {
      pixiAppSettings.changeInput(true, event.key);
    }
  }

  return false;
}
