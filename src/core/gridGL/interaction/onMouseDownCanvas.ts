import type { Viewport } from "pixi-viewport";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import { GridInteractionState } from "../../../atoms/gridInteractionStateAtom";

export const onMouseDownCanvas = (
  event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >,
  viewportRef: React.MutableRefObject<Viewport | undefined>
) => {
  // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
  if (viewportRef.current === undefined) return;

  // Calculate mouse down position
  const { x: downX, y: downY } = viewportRef.current.toWorld(
    event.clientX,
    event.clientY
  );
  let down_cell_x = Math.floor(downX / CELL_WIDTH);
  let down_cell_y = Math.floor(downY / CELL_HEIGHT);

  // Keep track of multiCursor previous position
  let previousPosition = {
    originPosition: { x: down_cell_x, y: down_cell_y },
    terminalPosition: { x: down_cell_x, y: down_cell_y },
  };

  // Move cursor to mouse down position
  // For single click, hide multiCursor
  setInteractionState({
    ...interactionState,
    ...{
      cursorPosition: { x: down_cell_x, y: down_cell_y },
      multiCursorPosition: previousPosition,
      showMultiCursor: false,
    },
  });

  function onMouseMove(move_event: any) {
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (viewportRef.current === undefined) return;

    // calculate mouse move position
    const { x: moveX, y: moveY } = viewportRef.current.toWorld(
      move_event.clientX,
      move_event.clientY
    );
    let move_cell_x = Math.floor(moveX / CELL_WIDTH);
    let move_cell_y = Math.floor(moveY / CELL_HEIGHT);

    // cursor start and end in the same cell
    if (move_cell_x === down_cell_x && move_cell_y === down_cell_y) {
      // hide multi cursor when only selecting one cell
      setInteractionState({
        cursorPosition: { x: down_cell_x, y: down_cell_y },
        multiCursorPosition: {
          originPosition: { x: down_cell_x, y: down_cell_y },
          terminalPosition: { x: down_cell_x, y: down_cell_y },
        },
        showMultiCursor: false,
        showInput: false,
        inputInitialValue: "",
      });
    } else {
      // cursor origin and terminal are not in the same cell

      // make origin top left, and terminal bottom right
      const originX = down_cell_x < move_cell_x ? down_cell_x : move_cell_x;
      const originY = down_cell_y < move_cell_y ? down_cell_y : move_cell_y;
      const termX = down_cell_x > move_cell_x ? down_cell_x : move_cell_x;
      const termY = down_cell_y > move_cell_y ? down_cell_y : move_cell_y;

      // determine if the cursor has moved from the previous event
      const hasMoved = !(
        previousPosition.originPosition.x === originX &&
        previousPosition.originPosition.y === originY &&
        previousPosition.terminalPosition.x === termX &&
        previousPosition.terminalPosition.y === termY
      );

      // only set state if changed
      // this reduces the number of hooks fired
      if (hasMoved) {
        // update multiCursor
        setInteractionState({
          cursorPosition: { x: down_cell_x, y: down_cell_y },
          multiCursorPosition: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          showMultiCursor: true,
          showInput: false,
          inputInitialValue: "",
        });

        viewportRef.current.dirty = true;

        // update previousPosition
        previousPosition = {
          originPosition: { x: originX, y: originY },
          terminalPosition: { x: termX, y: termY },
        };
      }
    }
  }

  // onMouseMove lifecycle events
  event.target.addEventListener("mousemove", onMouseMove);
  event.target.addEventListener("blur", () => {
    event.target?.removeEventListener("mousemove", onMouseMove);
  });
  event.target.addEventListener("mouseup", () => {
    event.target?.removeEventListener("mousemove", onMouseMove);
  });

  viewportRef.current.dirty = true;
};
