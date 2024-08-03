import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { doubleClickCell } from '../pointer/doubleClickCell';
import { isAllowedFirstChar } from './keyboardCellChars';
import { events } from '@/app/events/events';

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

export function keyboardCell(options: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}): boolean {
  const { event, editorInteractionState, setEditorInteractionState } = options;
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;
  const hasPermission = hasPermissionToEditFile(editorInteractionState.permissions);

  // Move cursor right, don't clear selection
  if (matchShortcut('move_cursor_right_with_selection', event)) {
    cursor.changePosition({
      keyboardMovePosition: {
        x: cursorPosition.x + 1,
        y: cursorPosition.y,
      },
      cursorPosition: {
        x: cursorPosition.x + 1,
        y: cursorPosition.y,
      },
    });
    return true;
  }

  // Move cursor left, don't clear selection
  if (matchShortcut('move_cursor_left_with_selection', event)) {
    cursor.changePosition({
      keyboardMovePosition: {
        x: cursorPosition.x - 1,
        y: cursorPosition.y,
      },
      cursorPosition: {
        x: cursorPosition.x - 1,
        y: cursorPosition.y,
      },
    });
    return true;
  }

  // Edit cell
  if (matchShortcut('edit_cell', event)) {
    if (!inlineEditorHandler.isEditingFormula()) {
      const column = cursorPosition.x;
      const row = cursorPosition.y;
      quadraticCore.getCodeCell(sheets.sheet.id, column, row).then((code) => {
        if (code) {
          doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
        } else {
          quadraticCore.getEditCell(sheets.sheet.id, column, row).then((cell) => {
            doubleClickCell({ column, row, cell });
          });
        }
      });
      return true;
    }
  }

  // Don't allow actions beyond here for certain users
  if (!hasPermission) {
    return false;
  }

  // Delete cell
  if (matchShortcut('delete_cell', event)) {
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
    return true;
  }

  // Show code editor
  if (matchShortcut('show_cell_type_menu', event)) {
    openCodeEditor();
    return true;
  }

  // Triggers Validation UI
  if (matchShortcut('trigger_cell', event)) {
    const p = sheets.sheet.cursor.cursorPosition;
    events.emit('pointerDown', p.x, p.y, true);
  }

  if (isAllowedFirstChar(event.key)) {
    const cursorPosition = cursor.cursorPosition;
    quadraticCore.getCodeCell(sheets.sheet.id, cursorPosition.x, cursorPosition.y).then((code) => {
      // open code cell unless this is the actual code cell. In this case we can overwrite it
      if (code && (Number(code.x) !== cursorPosition.x || Number(code.y) !== cursorPosition.y)) {
        doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
      } else {
        pixiAppSettings.changeInput(true, event.key);
      }
    });
    return true;
  }

  return false;
}
