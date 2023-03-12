import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Sheet } from '../../../grid/sheet/Sheet';
import { cellHasContent } from '../../helpers/selectCells';

export function keyboardPosition(options: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  sheet: Sheet;
}): boolean {
  const { event, interactionState, setInteractionState, sheet } = options;

  const setCursorPosition = (x: number, y: number): void => {
    const newPos = { x, y };
    setInteractionState({
      ...interactionState,
      showMultiCursor: false,
      keyboardMovePosition: newPos,
      cursorPosition: newPos,
      multiCursorPosition: {
        originPosition: newPos,
        terminalPosition: newPos,
      }
    });
  };

  const moveCursor = (deltaX: number, deltaY: number) => {

    // movePosition is either originPosition or terminalPosition (whichever !== cursorPosition)
    const downPosition = interactionState.cursorPosition;
    const movePosition = interactionState.keyboardMovePosition;

    // handle cases for meta/ctrl keys
    if (event.metaKey || event.ctrlKey) {

      const bounds = sheet.grid.getGridBounds(true);
      if (!bounds) {
        event.preventDefault();
        return;
      }

      if (deltaX === 1) {
        const originX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.x : interactionState.cursorPosition.x;
        const termX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.x : interactionState.cursorPosition.x;
        const originY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.y : interactionState.cursorPosition.y;
        const termY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.y : interactionState.cursorPosition.y;
        const keyboardX = interactionState.keyboardMovePosition.x;
        let x = keyboardX;
        const leftOfCursor = keyboardX < interactionState.cursorPosition.x;
        const y = interactionState.keyboardMovePosition.y;

        // always use the original cursor position to search
        const yCheck = interactionState.cursorPosition.y;

        // handle case of cell with content
        if (cellHasContent(sheet.grid.get(x, yCheck)?.cell)) {

          // if next cell is empty, find the next cell with content
          if (!cellHasContent(sheet.grid.get(x + 1, yCheck)?.cell)) {
            x = sheet.grid.findNextColumn({ xStart: x + 1, y: yCheck, delta: 1, withContent: true });
          }

          // if next cell is not empty, find the next empty cell
          else {
            x = sheet.grid.findNextColumn({ xStart: x + 1, y: yCheck, delta: 1, withContent: false }) - 1;
          }
        }

        // otherwise find the next cell with content
        else {
          x = sheet.grid.findNextColumn({ xStart: x + 1, y: yCheck, delta: 1, withContent: true });
          if (x === keyboardX) x++;
        }

        if (event.shiftKey) {
          setInteractionState({
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: leftOfCursor ? Math.min(x, termX) : originX, y: originY },
              terminalPosition: { x: leftOfCursor ? Math.max(x, termX) : x, y: termY },
            },
            keyboardMovePosition: { x, y },
            showMultiCursor: true,
          });
        } else {
          setCursorPosition(x, y);
        }
      }

      else if (deltaX === -1) {
        const originX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.x : interactionState.cursorPosition.x;
        const termX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.x : interactionState.cursorPosition.x
        const keyboardX = interactionState.keyboardMovePosition.x;
        let x = keyboardX;
        const rightOfCursor = keyboardX > interactionState.cursorPosition.x;
        const y = interactionState.keyboardMovePosition.y;

        // always use the original cursor position to search
        const yCheck = interactionState.cursorPosition.y;

        // handle case of cell with content
        if (cellHasContent(sheet.grid.get(x, yCheck)?.cell)) {

          // if next cell is empty, find the next cell with content
          if (!cellHasContent(sheet.grid.get(x - 1, yCheck)?.cell)) {
            x = sheet.grid.findNextColumn({ xStart: x - 1, y: yCheck, delta: -1, withContent: true });
          }

          // if next cell is not empty, find the next empty cell
          else {
            x = sheet.grid.findNextColumn({ xStart: x - 1, y: yCheck, delta: -1, withContent: false }) + 1;
          }
        }

        // otherwise find the next cell with content
        else {
          x = sheet.grid.findNextColumn({ xStart: x - 1, y: yCheck, delta: -1, withContent: true });
        }

        if (event.shiftKey) {
          const originY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.y : interactionState.cursorPosition.y;
          const termY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.y : interactionState.cursorPosition.y;
          setInteractionState({
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: rightOfCursor ? Math.min(x, originX) : x, y: originY },
              terminalPosition: { x: rightOfCursor ? Math.max(x, originX) : termX, y: termY },
            },
            keyboardMovePosition: { x, y },
            showMultiCursor: true,
          });
        } else {
          setCursorPosition(x, y);
        }
      }

      else if (deltaY === 1) {
        const originY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.y : interactionState.cursorPosition.y;
        const termY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.y : interactionState.cursorPosition.y;
        const keyboardY = interactionState.keyboardMovePosition.y;
        let y = keyboardY;
        const topOfCursor = keyboardY < interactionState.cursorPosition.y;
        const x = interactionState.keyboardMovePosition.x;

        // always use the original cursor position to search
        const xCheck = interactionState.cursorPosition.x;

        // handle case of cell with content
        if (cellHasContent(sheet.grid.get(xCheck, y)?.cell)) {

          // if next cell is empty, find the next cell with content
          if (!cellHasContent(sheet.grid.get(xCheck, y + 1)?.cell)) {
            y = sheet.grid.findNextRow({ x: xCheck, yStart: y + 1, delta: 1, withContent: true });
          }

          // if next cell is not empty, find the next empty cell
          else {
            y = sheet.grid.findNextRow({ x: xCheck, yStart: y + 1, delta: 1, withContent: false }) - 1;
          }
        }

        // otherwise find the next cell with content
        else {
          y = sheet.grid.findNextRow({ x: xCheck, yStart: y + 1, delta: 1, withContent: true });
          if (y === keyboardY) y++;
        }

        if (event.shiftKey) {
          const originX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.x : interactionState.cursorPosition.x;
          const termX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.x : interactionState.cursorPosition.x;
          setInteractionState({
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: originX, y: topOfCursor ? Math.min(y, termY) : originY },
              terminalPosition: { x: termX, y: topOfCursor ? Math.max(y, termY) : y },
            },
            keyboardMovePosition: { x, y },
            showMultiCursor: true,
          });
        } else {
          setCursorPosition(x, y);
        }
      }

      else if (deltaY === -1) {
        const originY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.y : interactionState.cursorPosition.y;
        const termY = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.y : interactionState.cursorPosition.y;
        const keyboardY = interactionState.keyboardMovePosition.y;
        let y = keyboardY;
        const bottomOfCursor = keyboardY > interactionState.cursorPosition.y;
        const x = interactionState.keyboardMovePosition.x;

        // always use the original cursor position to search
        const xCheck = interactionState.cursorPosition.x;

        // handle case of cell with content
        if (cellHasContent(sheet.grid.get(xCheck, y)?.cell)) {

          // if next cell is empty, find the next cell with content
          if (!cellHasContent(sheet.grid.get(xCheck, y - 1)?.cell)) {
            y = sheet.grid.findNextRow({ x: xCheck, yStart: y - 1, delta: -1, withContent: true });
          }

          // if next cell is not empty, find the next empty cell
          else {
            y = sheet.grid.findNextRow({ x: xCheck, yStart: y - 1, delta: -1, withContent: false }) + 1;
          }
        }

        // otherwise find the next cell with content
        else {
          y = sheet.grid.findNextRow({ x: xCheck, yStart: y - 1, delta: -1, withContent: true });
        }

        if (event.shiftKey) {
          const originX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.originPosition.x : interactionState.cursorPosition.x;
          const termX = interactionState.showMultiCursor ? interactionState.multiCursorPosition.terminalPosition.x : interactionState.cursorPosition.x;
          setInteractionState({
            ...interactionState,
            multiCursorPosition: {
              originPosition: { x: originX, y: bottomOfCursor ? Math.min(y, originY) : y },
              terminalPosition: { x: termX, y: bottomOfCursor ? Math.max(y, originY) : termY },
            },
            keyboardMovePosition: { x, y },
            showMultiCursor: true,
          });
        } else {
          setCursorPosition(x, y);
        }
      }
    }

    // use arrow to select when shift key is pressed
    else if (event.shiftKey) {
      // we are moving an existing multiCursor
      if (interactionState.showMultiCursor && downPosition && movePosition) {
        const newMovePosition = { x: movePosition.x + deltaX, y: movePosition.y + deltaY };
        const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
        const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
        const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
        const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
        setInteractionState({
          ...interactionState,
          multiCursorPosition: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          keyboardMovePosition: newMovePosition,
          showMultiCursor: true,
          showInput: false,
          inputInitialValue: '',
        });
      }

      // we are creating a new multiCursor
      else {
        const downPosition = { ...interactionState.cursorPosition };
        const newMovePosition = { x: downPosition.x + deltaX, y: downPosition.y + deltaY };
        const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
        const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
        const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
        const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
        setInteractionState({
          ...interactionState,
          multiCursorPosition: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          keyboardMovePosition: newMovePosition,
          showMultiCursor: true,
          showInput: false,
          inputInitialValue: '',
        });
      }
    }

    // move arrow normally
    else {
      const newPos = { x: interactionState.cursorPosition.x + deltaX, y: interactionState.cursorPosition.y + deltaY };
      setInteractionState({
        ...interactionState,
        keyboardMovePosition: newPos,
        showMultiCursor: false,
        cursorPosition: newPos,
        multiCursorPosition: {
          originPosition: newPos,
          terminalPosition: newPos,
        },
      });
    }
    event.preventDefault();
  };

  if (event.key === 'ArrowUp') {
    moveCursor(0, -1);
    return true;
  }

  if (event.key === 'ArrowRight') {
    moveCursor(1, 0);
    return true;
  }

  if (event.key === 'ArrowLeft') {
    moveCursor(-1, 0);
    return true;
  }

  if (event.key === 'ArrowDown') {
    moveCursor(0, 1);
    return true;
  }
  return false;
}
