import { EditorInteractionState } from '../../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../transaction/sheetController';
import { PixiApp } from '../../pixiApp/PixiApp';
import isAlphaNumeric from './isAlphaNumeric';

export function keyboardCell(options: {
  sheet_controller: SheetController;
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app?: PixiApp;
}): boolean {
  const { event, interactionState, setInteractionState, setEditorInteractionState, app, sheet_controller } = options;
  if (!app) return false;

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

  if (event.key === 'Backspace') {
    // delete a range or a single cell, depending on if MultiCursor is active
    if (interactionState.showMultiCursor) {
      // delete a range of cells
      const cells_to_delete = sheet_controller.sheet.grid.getNakedCells(
        interactionState.multiCursorPosition.originPosition.x,
        interactionState.multiCursorPosition.originPosition.y,
        interactionState.multiCursorPosition.terminalPosition.x,
        interactionState.multiCursorPosition.terminalPosition.y
      );

      sheet_controller.start_transaction();
      cells_to_delete.forEach((cell) => {
        sheet_controller.execute_statement({
          type: 'SET_CELL',
          data: { position: [cell.x, cell.y], value: undefined },
        });
      });
      sheet_controller.end_transaction();
      // TODO: Needs to update any dependent cells
    } else {
      // delete a single cell
      sheet_controller.predefined_transaction([
        {
          type: 'SET_CELL',
          data: { position: [interactionState.cursorPosition.x, interactionState.cursorPosition.y], value: undefined },
        },
      ]);
      // TODO: Needs to update any dependent cells
    }

    // todo: update dependency graph

    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
    const cell = sheet_controller.sheet.getCell(x, y)?.cell;
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
    const cell = sheet_controller.sheet.getCell(x, y)?.cell;
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
