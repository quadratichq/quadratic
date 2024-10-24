import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { CodeEditorState } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { isAllowedFirstChar } from '@/app/gridGL/interaction/keyboard/keyboardCellChars';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

function inCodeEditor(codeEditorState: CodeEditorState, cursor: SheetCursor): boolean {
  if (!codeEditorState.showCodeEditor) return false;
  const cursorPosition = cursor.cursorPosition;
  const selectedX = codeEditorState.codeCell.pos.x;
  const selectedY = codeEditorState.codeCell.pos.y;

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

export function keyboardCell(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { editorInteractionState, codeEditorState, setCodeEditorState } = pixiAppSettings;
  if (!setCodeEditorState) {
    throw new Error('Expected setCodeEditorState to be defined in keyboardCell');
  }

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;
  const hasPermission = hasPermissionToEditFile(editorInteractionState.permissions);

  // Move cursor right, don't clear selection
  if (matchShortcut(Action.MoveCursorRightWithSelection, event)) {
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
  if (matchShortcut(Action.MoveCursorLeftWithSelection, event)) {
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
  if (matchShortcut(Action.EditCell, event)) {
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
  if (matchShortcut(Action.DeleteCell, event)) {
    if (inCodeEditor(codeEditorState, cursor)) {
      if (!pixiAppSettings.unsavedEditorChanges) {
        setCodeEditorState?.((prev) => ({
          ...prev,
          showCodeEditor: false,
        }));
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
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
  if (matchShortcut(Action.ShowCellTypeMenu, event)) {
    openCodeEditor();
    return true;
  }

  // Triggers Validation UI
  if (matchShortcut(Action.TriggerCell, event)) {
    const p = sheets.sheet.cursor.cursorPosition;
    events.emit('triggerCell', p.x, p.y, true);
  }

  if (isAllowedFirstChar(event.key)) {
    const cursorPosition = cursor.cursorPosition;
    quadraticCore.getCodeCell(sheets.sheet.id, cursorPosition.x, cursorPosition.y).then((code) => {
      // open code cell unless this is the actual code cell (but not an import,
      // which is editable). In this case we can overwrite it
      if (
        code &&
        code.language !== 'Import' &&
        (Number(code.x) !== cursorPosition.x || Number(code.y) !== cursorPosition.y)
      ) {
        doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
      } else {
        pixiAppSettings.changeInput(true, event.key);
      }
    });
    return true;
  }

  return false;
}
