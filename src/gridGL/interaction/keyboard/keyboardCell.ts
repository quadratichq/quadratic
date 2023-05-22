import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { DeleteCells } from '../../../grid/actions/DeleteCells';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../pixiApp/PixiApp';
import { isAllowedFirstChar } from './keyboardCellChars';

export function keyboardCell(options: {
  sheet_controller: SheetController;
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app: PixiApp;
}): boolean {
  const {
    event,
    editorInteractionState,
    interactionState,
    setInteractionState,
    setEditorInteractionState,
    app,
    sheet_controller,
  } = options;

  if (event.key === 'Tab') {
    // move single cursor one right
    const delta = event.shiftKey ? -1 : 1;
    setInteractionState({
      ...interactionState,
      showMultiCursor: false,
      keyboardMovePosition: {
        x: interactionState.cursorPosition.x + delta,
        y: interactionState.cursorPosition.y,
      },
      cursorPosition: {
        x: interactionState.cursorPosition.x + delta,
        y: interactionState.cursorPosition.y,
      },
    });
    event.preventDefault();
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    // delete a range or a single cell, depending on if MultiCursor is active
    if (interactionState.showMultiCursor) {
      DeleteCells({
        x0: interactionState.multiCursorPosition.originPosition.x,
        y0: interactionState.multiCursorPosition.originPosition.y,
        x1: interactionState.multiCursorPosition.terminalPosition.x,
        y1: interactionState.multiCursorPosition.terminalPosition.y,
        sheetController: sheet_controller,
        app,
      });
    } else {
      // delete a single cell
      DeleteCells({
        x0: interactionState.cursorPosition.x,
        y0: interactionState.cursorPosition.y,
        x1: interactionState.cursorPosition.x,
        y1: interactionState.cursorPosition.y,
        sheetController: sheet_controller,
        app,
      });
    }

    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
    const cell = sheet_controller.sheet.getCellCopy(x, y);
    if (cell) {
      if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
        // open single line
        setInteractionState({
          ...interactionState,
          ...{
            showInput: true,
            inputInitialValue: cell.value,
          },
        });
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
      setInteractionState({
        ...interactionState,
        ...{
          showInput: true,
          inputInitialValue: '',
        },
      });
    }
    event.preventDefault();
  }

  if (event.key === '/' || event.key === '=') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
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
        setInteractionState({
          ...interactionState,
          ...{
            showInput: true,
            inputInitialValue: cell.value,
          },
        });
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
    setInteractionState({
      ...interactionState,
      ...{
        showInput: true,
        inputInitialValue: event.key,
      },
    });

    event.preventDefault();
  }

  return false;
}
