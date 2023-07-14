import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { DeleteCells } from '../../../grid/actions/DeleteCells';
import { SheetController } from '../../../grid/controller/sheetController';
import { isAllowedFirstChar } from './keyboardCellChars';

export function keyboardCell(options: {
  sheet_controller: SheetController;
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}): boolean {
  const { event, editorInteractionState, setEditorInteractionState, sheet_controller } = options;

  const cursor = sheet_controller.sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

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

  if (event.key === 'Backspace' || event.key === 'Delete') {
    // delete a range or a single cell, depending on if MultiCursor is active
    DeleteCells({
      x0: cursor.originPosition.x,
      y0: cursor.originPosition.y,
      x1: cursor.terminalPosition.x,
      y1: cursor.terminalPosition.y,
      sheetController: sheet_controller,
    });
    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    const cell = sheet_controller.sheet.getCellCopy(x, y);
    if (cell) {
      if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
        // open single line
        cursor.changeInput(true, cell.value);
      } else {
        // Open code editor, or move code editor if already open.
        setEditorInteractionState({
          ...editorInteractionState,
          showCellTypeMenu: false,
          showCodeEditor: true,
          selectedCell: { x: x, y: y },
          mode: cell.type,
        });
      }
    } else {
      cursor.changeInput(true);
    }
    event.preventDefault();
  }

  if (event.key === '/' || event.key === '=') {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    const cell = sheet_controller.sheet.getCellCopy(x, y);
    if (cell) {
      if (cell.type === 'PYTHON') {
        // Open code editor, or move code editor if already open.
        setEditorInteractionState({
          ...editorInteractionState,
          showCellTypeMenu: false,
          showCodeEditor: true,
          selectedCell: { x: x, y: y },
          mode: 'PYTHON',
        });
      } else {
        // Open cell input for editing text
        cursor.changeInput(true, cell.value);
      }
    } else {
      // Open cell type menu, close editor.
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: true,
        showCodeEditor: false,
        selectedCell: { x: x, y: y },
        mode: 'PYTHON',
      });
    }
    event.preventDefault();
  }

  if (isAllowedFirstChar(event.key)) {
    cursor.changeInput(true, event.key);
    event.preventDefault();
  }

  return false;
}
