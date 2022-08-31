import { copyToClipboard, pasteFromClipboard } from '../../actions/clipboard';
import { deleteCellsRange } from '../../actions/deleteCellsRange';
import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';
import isAlphaNumeric from './helpers/isAlphaNumeric';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { getGridMinMax } from '../../../helpers/getGridMinMax';
import type { Viewport } from 'pixi-viewport';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';

export const onKeyDownCanvas = (
  event: React.KeyboardEvent<HTMLCanvasElement>,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<
    React.SetStateAction<EditorInteractionState>
  >,
  viewportRef: React.MutableRefObject<Viewport | undefined>
) => {
  // TODO make commands work cross platform
  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyV') {
    pasteFromClipboard({
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
  }

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyC') {
    copyToClipboard(
      {
        x: interactionState.multiCursorPosition.originPosition.x,
        y: interactionState.multiCursorPosition.originPosition.y,
      },
      {
        x: interactionState.multiCursorPosition.terminalPosition.x,
        y: interactionState.multiCursorPosition.terminalPosition.y,
      }
    );
  }

  // Command + A
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyA') {
    // Calculate the min and max cells.
    // Select all cells
    const selectAllCells = async () => {
      const bounds = await getGridMinMax();

      if (bounds !== undefined) {
        setInteractionState({
          ...interactionState,
          ...{
            multiCursorPosition: {
              originPosition: bounds[0],
              terminalPosition: bounds[1],
            },
            showMultiCursor: true,
          },
        });

        if (viewportRef.current) viewportRef.current.dirty = true;
      }
    };
    selectAllCells();

    event.preventDefault();
  }

  // Prevent these commands if "command" key is being pressed
  if (event.metaKey || event.ctrlKey) {
    return;
  }

  const moveCursor = (deltaX: number, deltaY: number) => {
    if (event.shiftKey) {
      let originPosition: { x: number, y: number };
      let terminalPosition: { x: number, y: number };
      if (interactionState.showMultiCursor) {
        originPosition = { ...interactionState.multiCursorPosition.originPosition };
        terminalPosition = { ...interactionState.multiCursorPosition.terminalPosition };
      } else {
        originPosition = { ...interactionState.cursorPosition };
        terminalPosition = { ...interactionState.cursorPosition };
      }
      terminalPosition.x += deltaX;
      terminalPosition.y += deltaY;

      // if (originPosition.x === terminalPosition.x && originPosition.y === terminalPosition.y) {
      //   setInteractionState({
      //     ...interactionState,
      //     showMultiCursor: false,
      //     cursorPosition: {
      //       x: interactionState.multiCursorPosition.originPosition.x + deltaX,
      //       y: interactionState.multiCursorPosition.originPosition.y + deltaY
      //     }
      //   });
      // } else {
        // if (originPosition.x > terminalPosition.x) {
        //   const swap = originPosition.x;
        //   originPosition.x = terminalPosition.x;
        //   terminalPosition.x = swap;
        // }
        // if (originPosition.y > terminalPosition.y) {
        //   const swap = originPosition.y;
        //   originPosition.y = terminalPosition.y;
        //   terminalPosition.y = swap;
        // }
        setInteractionState({
          ...interactionState,
          showMultiCursor: true,
          multiCursorPosition: {
            originPosition,
            terminalPosition: { x: terminalPosition.x, y: terminalPosition.y },
          }
        });
      // }
    } else {
      setInteractionState({
        ...interactionState,
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x + deltaX,
          y: interactionState.cursorPosition.y + deltaY
        }
      });
    }
    event.preventDefault();
  };

  if (event.key === 'ArrowUp') {
    moveCursor(0, -1);
  }  else if (event.key === 'ArrowRight') {
    moveCursor(1, 0);
  } else if (event.key === 'ArrowLeft') {
    moveCursor(-1, 0);
  } else if (event.key === 'ArrowDown') {
    moveCursor(0, 1);
  }

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
    GetCellsDB(x, y, x, y).then((cells) => {
      if (cells.length) {
        const cell = cells[0];

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
            mode: cells[0].type,
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
    });
    event.preventDefault();
  }

  if (event.key === '/' || event.key === '=') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
    GetCellsDB(x, y, x, y).then((cells) => {
      if (cells.length) {
        if (cells[0].type === 'PYTHON') {
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
              inputInitialValue: cells[0].value,
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
    });
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
};
