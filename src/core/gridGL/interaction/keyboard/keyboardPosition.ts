import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';

export function keyboardPosition(options: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
}): boolean {
  const { event, interactionState, setInteractionState } = options;

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
        keyboardMovePosition: {
          x: interactionState.cursorPosition.x + deltaX,
          y: interactionState.cursorPosition.y + deltaY,
        },
        showMultiCursor: false,
        cursorPosition: {
          x: interactionState.cursorPosition.x + deltaX,
          y: interactionState.cursorPosition.y + deltaY,
        },
      };
      setInteractionState(newInteractionState);
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
