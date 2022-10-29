import { EditorInteractionState } from '../../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { deleteCellsRange } from '../../../actions/deleteCellsRange';
import { PixiApp } from '../../pixiApp/PixiApp';
import isAlphaNumeric from './isAlphaNumeric';

export function keyboardCell(options: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app?: PixiApp;
}): boolean {
  const { event, interactionState, setInteractionState, setEditorInteractionState, app } = options;
  if (!app) return false;

  if (event.key === 'Tab') {
    // move single cursor one right
    setInteractionState({
      ...interactionState,
      ...{
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x + 1,
          y: interactionState.cursorPosition.y,
        },
      },
    });
    event.preventDefault();
  }

  if (event.key === 'Backspace') {
    // delete a range or a single cell, depending on if MultiCursor is active
    if (interactionState.showMultiCursor) {
      // delete a range of cells
      deleteCellsRange(
        {
          x: interactionState.multiCursorPosition.originPosition.x,
          y: interactionState.multiCursorPosition.originPosition.y,
        },
        {
          x: interactionState.multiCursorPosition.terminalPosition.x,
          y: interactionState.multiCursorPosition.terminalPosition.y,
        }
      );
    } else {
      // delete a single cell
      deleteCellsRange(
        {
          x: interactionState.cursorPosition.x,
          y: interactionState.cursorPosition.y,
        },
        {
          x: interactionState.cursorPosition.x,
          y: interactionState.cursorPosition.y,
        }
      );
    }

    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
    const cell = app.grid.get(x, y);
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
    const cell = app.grid.get(x, y);
    if (cell) {
      if (cell.type === 'PYTHON') {
        // Open code editor, or move code editor if already open.
        setEditorInteractionState({
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
        showCellTypeMenu: true,
        showCodeEditor: false,
        selectedCell: { x: x, y: y },
        mode: 'PYTHON',
      });
    }
    event.preventDefault();
  }

  // if key is a letter number or space start taking input
  if (isAlphaNumeric(event.key) || event.key === ' ') {
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
