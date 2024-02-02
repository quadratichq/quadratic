import { SheetCursor } from '@/grid/sheet/SheetCursor';
import { Rectangle } from 'pixi.js';
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
  if (cursor.multiCursor) {
    if (
      selectedX >= cursor.originPosition.x &&
      selectedX <= cursor.terminalPosition.x &&
      selectedY >= cursor.originPosition.y &&
      selectedY <= cursor.terminalPosition.y
    ) {
      return true;
    }
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

  if (event.key === 'Tab') {
    // move single cursor one right
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
    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const column = cursorPosition.x;
    const row = cursorPosition.y;
    const code = sheet.getCodeCell(column, row);
    if (code) {
      doubleClickCell({ column: Number(code.x), row: Number(code.y), mode: code.language, cell: '' });
    } else {
      const cell = sheet.getEditCell(column, row);
      doubleClickCell({ column, row, cell });
    }
    event.preventDefault();
  }

  // Don't allow actions beyond here for certain users
  if (!hasPermission) {
    return false;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (!inCodeEditor(editorInteractionState, cursor)) {
      // delete a range or a single cell, depending on if MultiCursor is active
      sheet.deleteCells(
        new Rectangle(
          cursor.originPosition.x,
          cursor.originPosition.y,
          cursor.terminalPosition.x - cursor.originPosition.x,
          cursor.terminalPosition.y - cursor.originPosition.y
        )
      );
    }
    event.preventDefault();
  }

  if (event.key === '/' || event.key === '=') {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    const cell = sheet.getRenderCell(x, y);
    if (cell?.language) {
      if (editorInteractionState.showCodeEditor) {
        // Open code editor, or move change editor if already open.
        setEditorInteractionState({
          ...editorInteractionState,
          showCellTypeMenu: false,
          waitingForEditorClose: {
            selectedCell: { x: x, y: y },
            selectedCellSheet: sheets.sheet.id,
            mode: cell.language,
            showCellTypeMenu: false,
          },
        });
      } else {
        setEditorInteractionState({
          ...editorInteractionState,
          showCellTypeMenu: false,
          selectedCell: { x: x, y: y },
          selectedCellSheet: sheets.sheet.id,
          mode: cell.language,
          showCodeEditor: true,
        });
      }
    } else if (editorInteractionState.showCodeEditor) {
      // code editor is already open, so check it for save before closing
      setEditorInteractionState({
        ...editorInteractionState,
        waitingForEditorClose: {
          showCellTypeMenu: true,
          selectedCell: { x: x, y: y },
          selectedCellSheet: sheets.sheet.id,
          mode: 'Python',
        },
      });
    } else {
      // just open the code editor selection menu
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: true,
        selectedCell: { x: x, y: y },
        selectedCellSheet: sheets.sheet.id,
        mode: undefined,
      });
    }
    event.preventDefault();
  }

  if (isAllowedFirstChar(event.key)) {
    const cursorPosition = cursor.cursorPosition;
    const code = sheet.getCodeCell(cursorPosition.x, cursorPosition.y);

    // open code cell unless this is the actual code cell. In this case we can overwrite it
    if (code && (Number(code.x) !== cursorPosition.x || Number(code.y) !== cursorPosition.y)) {
      doubleClickCell({ column: Number(code.x), row: Number(code.y), mode: code.language, cell: '' });
    } else {
      pixiAppSettings.changeInput(true, event.key);
    }
    event.preventDefault();
  }

  return false;
}
