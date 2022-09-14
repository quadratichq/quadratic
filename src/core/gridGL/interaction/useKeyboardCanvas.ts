import React from 'react';
import type { Viewport } from 'pixi-viewport';
import { copyToClipboard, pasteFromClipboard } from '../../actions/clipboard';
import { deleteCellsRange } from '../../actions/deleteCellsRange';
import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';
import isAlphaNumeric from './helpers/isAlphaNumeric';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { getGridMinMax } from '../../../helpers/getGridMinMax';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { ensureVisible } from './ensureVisible';
import { Size } from '../types/size';

interface IProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboardCanvas = (
  props: IProps
): {
  onKeyDownCanvas: (event: React.KeyboardEvent<HTMLCanvasElement>) => void;
} => {
  const { interactionState, setInteractionState, setEditorInteractionState, viewportRef } = props;

  const onKeyDownCanvas = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
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
      let newInteractionState: GridInteractionState | undefined;

      // movePosition is either originPosition or terminalPosition (whichever !== cursorPosition)
      const downPosition = interactionState.cursorPosition;
      const movePosition = interactionState.keyboardMovePosition;

      // use arrow to select when shift key is pressed
      if (event.shiftKey) {
        // we are moving an existing multiCursor
        if (interactionState.showMultiCursor && downPosition && movePosition) {
          const newMovePosition = { x: movePosition.x + deltaX, y: movePosition.y + deltaY };
          const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
          const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
          const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
          const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
          newInteractionState = {
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: originX, y: originY },
              terminalPosition: { x: termX, y: termY },
            },
            keyboardMovePosition: newMovePosition,
            showMultiCursor: true,
            showInput: false,
            inputInitialValue: '',
          };
          setInteractionState(newInteractionState);
        }

        // we are creating a new multiCursor
        else {
          const downPosition = { ...interactionState.cursorPosition };
          const newMovePosition = { x: downPosition.x + deltaX, y: downPosition.y + deltaY };
          const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
          const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
          const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
          const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
          newInteractionState = {
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: originX, y: originY },
              terminalPosition: { x: termX, y: termY },
            },
            keyboardMovePosition: newMovePosition,
            showMultiCursor: true,
            showInput: false,
            inputInitialValue: '',
          };
          setInteractionState(newInteractionState);
        }
      }

      // move arrow normally
      else {
        newInteractionState = {
          ...interactionState,
          showMultiCursor: false,
          cursorPosition: {
            x: interactionState.cursorPosition.x + deltaX,
            y: interactionState.cursorPosition.y + deltaY,
          },
        };
        setInteractionState(newInteractionState);
      }
      event.preventDefault();
      if (viewportRef.current) {
        ensureVisible({
          interactionState: newInteractionState,
          viewport: viewportRef.current,
          headerSize: pixiKeyboardCanvasProps.headerSize,
        });
      }
    };

    if (event.key === 'ArrowUp') {
      moveCursor(0, -1);
    } else if (event.key === 'ArrowRight') {
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

  return {
    onKeyDownCanvas,
  };
};
