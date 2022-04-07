import { copyToClipboard, pasteFromClipboard } from '../../actions/clipboard';
import { deleteCellsRange } from '../../actions/deleteCellsRange';
import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';
import isAlphaNumeric from './helpers/isAlphaNumeric';
import { NavigateFunction } from 'react-router-dom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { qdb } from '../../gridDB/db';
import type { Viewport } from 'pixi-viewport';

export const onKeyDownCanvas = (
  event: React.KeyboardEvent<HTMLCanvasElement>,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >,
  navigate: NavigateFunction,
  viewportRef: React.MutableRefObject<Viewport | undefined>
) => {
  // TODO make commands work cross platform
  // Command + V
  if (event.metaKey && event.code === 'KeyV') {
    pasteFromClipboard({
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
  }

  // Command + C
  if (event.metaKey && event.code === 'KeyC') {
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
  if (event.metaKey && event.code === 'KeyA') {
    // Calculate the min and max cells.
    // Select all cells
    const selectAllCells = async () => {
      let x_min = await qdb.cells.orderBy('x').first();
      let x_max = await qdb.cells.orderBy('x').last();
      let y_min = await qdb.cells.orderBy('y').first();
      let y_max = await qdb.cells.orderBy('y').last();

      if (x_min && x_max && y_min && y_max) {
        setInteractionState({
          ...interactionState,
          ...{
            multiCursorPosition: {
              originPosition: { x: x_min.x, y: y_min.y },
              terminalPosition: { x: x_max.x, y: y_max.y },
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
  if (event.metaKey) {
    return;
  }

  if (event.key === 'ArrowUp') {
    setInteractionState({
      ...interactionState,
      ...{
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x,
          y: interactionState.cursorPosition.y - 1,
        },
      },
    });

    event.preventDefault();
  }
  if (event.key === 'ArrowRight') {
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
  if (event.key === 'ArrowLeft') {
    setInteractionState({
      ...interactionState,
      ...{
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x - 1,
          y: interactionState.cursorPosition.y,
        },
      },
    });

    event.preventDefault();
  }
  if (event.key === 'ArrowDown') {
    setInteractionState({
      ...interactionState,
      ...{
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x,
          y: interactionState.cursorPosition.y + 1,
        },
      },
    });
    event.preventDefault();
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
          navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
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

  if (event.key === '/') {
    const x = interactionState.cursorPosition.x;
    const y = interactionState.cursorPosition.y;
    GetCellsDB(x, y, x, y).then((cells) => {
      if (cells.length) {
        navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
      } else {
        navigate(`/cell-type-menu/${x}/${y}`);
      }
    });
    event.preventDefault();
  }

  // if key is a letter or enter start taking input
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
