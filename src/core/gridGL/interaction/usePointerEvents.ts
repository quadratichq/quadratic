import * as PIXI from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import React, { useCallback, useState } from 'react';
import { onDoubleClickCanvas } from './onDoubleClickCanvas';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { intersectsHeadings } from '../graphics/gridHeadings';
import { selectAllCells } from './selectCells';
import { intersects } from '../helpers/intersects';

interface IProps {
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

interface MousePosition {
  x: number;
  y: number;
}

const MINIMUM_MOVE_POSITION = 5;
const DOUBLE_CLICK_TIME = 500;

let headingDownTimeout: number | undefined;

export const usePointerEvents = (
  props: IProps
): {
  isDoubleClick: (world: PIXI.Point, event: PointerEvent) => boolean;
  onPointerDown: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerMove: (world: PIXI.Point, event: PointerEvent) => void;
  onPointerUp: () => void;
} => {
  const { viewportRef, interactionState, setInteractionState } = props;

  const [downPosition, setDownPosition] = useState<MousePosition | undefined>();
  const [downPositionRaw, setDownPositionRaw] = useState<MousePosition | undefined>();
  const [previousPosition, setPreviousPosition] = useState<
    { originPosition: MousePosition; terminalPosition: MousePosition } | undefined
  >();
  const [pointerMoved, setPointerMoved] = useState(false);
  const [doubleClickTimeout, setDoubleClickTimeout] = useState<number | undefined>();

  const [downHeadingPosition, setDownHeadingPosition] = useState<PIXI.Point | undefined>();

  const isDoubleClick = (world: PIXI.Point, event: PointerEvent): boolean => {
    if (event.button !== 0 || !downPositionRaw || !props.viewportRef.current) return false;
    if (
      doubleClickTimeout &&
      !pointerMoved &&
      Math.abs(downPositionRaw.x - world.x) + Math.abs(downPositionRaw.y - world.y) <
        MINIMUM_MOVE_POSITION * props.viewportRef.current.scale.x
    ) {
      setDoubleClickTimeout(undefined);
      onDoubleClickCanvas(event, props.interactionState, props.setInteractionState, props.setEditorInteractionState);
      return true;
    }
    return false;
  };

  const moveToCorner = useCallback((): void => {
    props.setInteractionState({
      keyboardMovePosition: { x: 0, y: 0 },
      cursorPosition: { x: 0, y: 0 },
      showMultiCursor: false,
      multiCursorPosition: {
        originPosition: { x: 0, y: 0 },
        terminalPosition: { x: 0, y: 0 },
      },
      showInput: false,
      inputInitialValue: '',
    });
    const viewport = viewportRef.current;
    if (viewport) {
      const cell = new PIXI.Rectangle(0, 0, CELL_WIDTH, CELL_HEIGHT);
      console.log(cell, viewport.getVisibleBounds())
      if (!intersects.rectangleRectangle(viewport.getVisibleBounds(), cell)) {
        viewport.animate({
          time: 200,
          position: new PIXI.Point(viewport.worldScreenWidth / 2 - 20, viewport.worldScreenHeight / 2 - 20),
          ease: "easeInOutSine",
        });
      }
    }
  }, [props, viewportRef]);

  const selectAll = (): void => {
    selectAllCells({
      setInteractionState: props.setInteractionState,
      interactionState: props.interactionState,
      viewport: viewportRef.current,
    });
  }

  const isHeadingClick = (world: PIXI.Point): boolean => {
    const intersects = intersectsHeadings(world);
    if (!intersects) return false;
    if (intersects.corner) {
      if (headingDownTimeout) {
        headingDownTimeout = undefined;
        setDownHeadingPosition(undefined);
        moveToCorner();
      } else {
        setDownHeadingPosition(world);
      }
    }

    // todo: handle select entire row or column

    return true;
  };

  const onPointerDown = (world: PIXI.Point, event: PointerEvent) => {
    if (isHeadingClick(world)) return;
    if (isDoubleClick(world, event)) return;
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (viewportRef.current === undefined) return;
    setDownPositionRaw({ x: world.x, y: world.y });
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
    setPointerMoved(false);
  };

  const changeMouseCursor = (world: PIXI.Point): void => {
    // todo: this is not ideal -- need a better way of getting canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.cursor = intersectsHeadings(world) ? "pointer" : "auto";
    }
  };

  const onPointerMove = (world: PIXI.Point, _: PointerEvent): void => {
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (props.viewportRef.current === undefined) return;

    changeMouseCursor(world);

    if (downPosition === undefined || previousPosition === undefined || downPositionRaw === undefined) return;


    // for determining if double click
    if (
      !pointerMoved &&
      Math.abs(downPositionRaw.x - world.x) + Math.abs(downPositionRaw.y - world.y) >
        MINIMUM_MOVE_POSITION * props.viewportRef.current.scale.x
    ) {
      setPointerMoved(true);
    }

    // calculate mouse move position
    let move_cell_x = Math.floor(world.x / CELL_WIDTH);
    let move_cell_y = Math.floor(world.y / CELL_HEIGHT);

    // cursor start and end in the same cell
    if (move_cell_x === downPosition.x && move_cell_y === downPosition.y) {
      // hide multi cursor when only selecting one cell
      props.setInteractionState({
        keyboardMovePosition: { x: downPosition.x, y: downPosition.y },
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
          keyboardMovePosition: { x: move_cell_x, y: move_cell_y },
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
  };

  const onPointerUp = () => {
    if (downPosition && !pointerMoved) {
      const timeout = window.setTimeout(() => setDoubleClickTimeout(undefined), DOUBLE_CLICK_TIME);
      setDoubleClickTimeout(timeout);
    }
    setDownPosition(undefined);
    setPreviousPosition(undefined);

    if (downHeadingPosition) {
      headingDownTimeout = window.setTimeout(() => {
        if (headingDownTimeout) {
          selectAll();
          headingDownTimeout = undefined;
        }
        setDownHeadingPosition(undefined);
      }, DOUBLE_CLICK_TIME);
    }
  };

  return {
    isDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};
