import CellReference from "../types/cellReference";
import { MultiCursorPosition } from "../../../atoms/cursorAtoms";
import { SetterOrUpdater } from "recoil";
import type { Viewport } from "pixi-viewport";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";

export const onMouseDownCanvas = (
  event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
  setCursorPosition: SetterOrUpdater<CellReference>,
  setMulticursorPosition: SetterOrUpdater<MultiCursorPosition>,
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

  // Move cursor to mouse down position
  setCursorPosition({ x: down_cell_x, y: down_cell_y });

  viewportRef.current.dirty = true;

  // Keep track of multicursor previous position
  let previousPosition = {
    originLocation: { x: 0, y: 0 },
    terminalLocation: { x: 0, y: 0 },
    visible: false,
  } as MultiCursorPosition;

  // If single click, make sure to hide multicursor
  setMulticursorPosition(previousPosition);

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
      setMulticursorPosition({
        originLocation: { x: down_cell_x, y: down_cell_y },
        terminalLocation: { x: move_cell_x, y: move_cell_y },
        visible: false,
      });
      viewportRef.current.dirty = true;
    } else {
      // cursor origin and terminal are not in the same cell

      // make origin top left, and terminal bottom right
      const originX = down_cell_x < move_cell_x ? down_cell_x : move_cell_x;
      const originY = down_cell_y < move_cell_y ? down_cell_y : move_cell_y;
      const termX = down_cell_x > move_cell_x ? down_cell_x : move_cell_x;
      const termY = down_cell_y > move_cell_y ? down_cell_y : move_cell_y;

      // determine if the cursor has moved from the previous event
      const hasMoved = !(
        previousPosition.originLocation.x === originX &&
        previousPosition.originLocation.y === originY &&
        previousPosition.terminalLocation.x === termX &&
        previousPosition.terminalLocation.y === termY
      );

      // only set state if changed
      // this reduces the number of hooks fired
      if (hasMoved) {
        // update multicursor
        const newPosition = {
          originLocation: { x: originX, y: originY },
          terminalLocation: { x: termX, y: termY },
          visible: true,
        } as MultiCursorPosition;
        setMulticursorPosition(newPosition);
        viewportRef.current.dirty = true;

        // update previousPosition
        previousPosition = newPosition;
      }
    }
  }

  // onMouseMove lifecycle events
  event.target.addEventListener("mousemove", onMouseMove);
  event.target.addEventListener("mouseup", () => {
    event.target?.removeEventListener("mousemove", onMouseMove);
  });
};
