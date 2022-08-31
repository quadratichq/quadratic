import * as PIXI from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import React, { useState } from 'react';

interface IProps {
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
}

export const usePointerEvents = (props: IProps): {
  onPointerDown: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerMove: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerUp: () => void;
} => {
  const { viewportRef, interactionState, setInteractionState } = props;

  const [downPosition, setDownPosition] = useState<{ x: number, y: number } | undefined>();
  const [previousPosition, setPreviousPosition] = useState<{ originPosition: { x: number, y: number }, terminalPosition: { x: number, y: number } } | undefined>();

  const onPointerDown = (
    world: PIXI.Point,
    event: PointerEvent,
  ) => {
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (viewportRef.current === undefined) return;

    let down_cell_x = Math.floor(world.x / CELL_WIDTH);
    let down_cell_y = Math.floor(world.y / CELL_HEIGHT);

    const rightClick = event.button === 2 || (event.button === 0 && event.ctrlKey);

    // If right click and we have a multi cell selection.
    // If the user has clicked inside the selection.
    if (rightClick && props.interactionState.showMultiCursor) {
      if (
        down_cell_x >= props.interactionState.multiCursorPosition.originPosition.x &&
        down_cell_x <= props.interactionState.multiCursorPosition.terminalPosition.x &&
        down_cell_y >= props.interactionState.multiCursorPosition.originPosition.y &&
        down_cell_y <= props.interactionState.multiCursorPosition.terminalPosition.y
      )
        // Ignore this click. User is accessing the RightClickMenu.
        return;
    }

    // otherwise ignore right click
    else if (rightClick) {
      return;
    }

    setDownPosition({ x: down_cell_x, y: down_cell_y });

    const previousPosition = {
      originPosition: { x: down_cell_x, y: down_cell_y },
      terminalPosition: { x: down_cell_x, y: down_cell_y },
    };

    // Keep track of multiCursor previous position
    setPreviousPosition(previousPosition);

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
  };

  const onPointerMove = (world: PIXI.Point, _: PointerEvent): void => {
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (props.viewportRef.current === undefined) return;
    if (downPosition === undefined || previousPosition === undefined) return;

    // calculate mouse move position
    let move_cell_x = Math.floor(world.x / CELL_WIDTH);
    let move_cell_y = Math.floor(world.y / CELL_HEIGHT);

    // cursor start and end in the same cell
    if (move_cell_x === downPosition.x && move_cell_y === downPosition.y) {
      // hide multi cursor when only selecting one cell
      props.setInteractionState({
        cursorPosition: { x: downPosition.x, y: downPosition.y },
        multiCursorPosition: {
          originPosition: { x: downPosition.x, y: downPosition.y },
          terminalPosition: { x: downPosition.x, y: downPosition.y },
        },
        showMultiCursor: false,
        showInput: false,
        inputInitialValue: '',
      });
    } else {
      // cursor origin and terminal are not in the same cell

      // make origin top left, and terminal bottom right
      const originX = downPosition.x < move_cell_x ? downPosition.x : move_cell_x;
      const originY = downPosition.y < move_cell_y ? downPosition.y : move_cell_y;
      const termX = downPosition.x > move_cell_x ? downPosition.x : move_cell_x;
      const termY = downPosition.y > move_cell_y ? downPosition.y : move_cell_y;

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
        props.setInteractionState({
          cursorPosition: { x: downPosition.x, y: downPosition.y },
          multiCursorPosition: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          showMultiCursor: true,
          showInput: false,
          inputInitialValue: '',
        });

        props.viewportRef.current.dirty = true;

        // update previousPosition
        setPreviousPosition({
          originPosition: { x: originX, y: originY },
          terminalPosition: { x: termX, y: termY },
        });
      }
    }
  }

  const onPointerUp = () => {
    setDownPosition(undefined);
    setPreviousPosition(undefined);
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
};
