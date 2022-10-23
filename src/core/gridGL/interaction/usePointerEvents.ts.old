import * as PIXI from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import React, { useState } from 'react';
import { onDoubleClickCanvas } from './onDoubleClickCanvas';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { intersectsHeadingGridLine, intersectsHeadings } from '../graphics/gridHeadings';
import { selectAllCells, selectColumns, selectRows } from './selectCellsAction';
import { zoomToFit } from './zoom';
import { gridOffsets } from '../../gridDB/gridOffsets';

interface IProps {
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  setHeadingResizing: (resize: HeadingResizing | undefined) => void;
  saveHeadingResizing: () => void;
  headingResizing: HeadingResizing | undefined;
}

interface MousePosition {
  x: number;
  y: number;
}

export interface HeadingResizing {
  x: number;
  y: number;
  start: number;
  column?: number;
  row?: number;
  width?: number;
  height?: number;
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

  const selectAll = (): void => {
    selectAllCells({
      setInteractionState: props.setInteractionState,
      interactionState: props.interactionState,
      viewport: viewportRef.current,
    });
  };

  const isHeadingClick = (world: PIXI.Point, event: PointerEvent): boolean => {
    const intersects = intersectsHeadings(world);
    if (!intersects) return false;
    if (intersects.corner) {
      if (headingDownTimeout) {
        headingDownTimeout = undefined;
        if (viewportRef.current) {
          zoomToFit(viewportRef.current);
        }
      } else {
        selectAll();
        headingDownTimeout = window.setTimeout(() => {
          if (headingDownTimeout) {
            headingDownTimeout = undefined;
          }
        }, DOUBLE_CLICK_TIME);
      }
    }

    if (event.shiftKey) {
      if (intersects.column !== undefined) {
        let x1 = interactionState.cursorPosition.x;
        let x2 = intersects.column;
        selectColumns({
          setInteractionState: props.setInteractionState,
          interactionState: props.interactionState,
          viewport: viewportRef.current,
          start: Math.min(x1, x2),
          end: Math.max(x1, x2),
        });
      } else if (intersects.row !== undefined) {
        let y1 = interactionState.cursorPosition.y;
        let y2 = intersects.row;
        selectRows({
          setInteractionState: props.setInteractionState,
          interactionState: props.interactionState,
          viewport: viewportRef.current,
          start: Math.min(y1, y2),
          end: Math.max(y1, y2),
        });
      }
    } else {
      selectAllCells({
        setInteractionState: props.setInteractionState,
        interactionState: props.interactionState,
        viewport: viewportRef.current,
        column: intersects.column,
        row: intersects.row,
      });
    }
    return true;
  };

  const isHeadingResize = (world: PIXI.Point, event: PointerEvent): boolean => {
    if (event.shiftKey) return false;
    const headingResize = intersectsHeadingGridLine(world);
    if (headingResize) {
      props.setHeadingResizing({
        x: world.x,
        y: world.y,
        start: headingResize.start,
        row: headingResize.row,
        column: headingResize.column,
        width: headingResize.width,
        height: headingResize.height,
      })
      return true;
    }
    return false;
  }

  const selectShiftPointerDown = (world: PIXI.Point, event: PointerEvent): boolean => {
    if (!event.shiftKey) return false;
    const x = Math.floor(world.x / CELL_WIDTH);
    const y = Math.floor(world.y / CELL_HEIGHT);
    const cursorPosition = props.interactionState.cursorPosition;
    const minX = Math.min(x, cursorPosition.x);
    const minY = Math.min(y, cursorPosition.y);
    const maxX = Math.max(x, cursorPosition.x);
    const maxY = Math.max(y, cursorPosition.y);
    setInteractionState({
      ...interactionState,
      showMultiCursor: true,
      multiCursorPosition: {
        originPosition: { x: minX, y: minY },
        terminalPosition: { x: maxX, y: maxY },
      },
    });
    return true;
  };

  const onPointerDown = (world: PIXI.Point, event: PointerEvent) => {
    if (viewportRef.current === undefined) return;
    if (isHeadingResize(world, event)) return;
    if (isHeadingClick(world, event)) return;
    if (isDoubleClick(world, event)) return;
    if (selectShiftPointerDown(world, event)) return;

    setDownPositionRaw({ x: world.x, y: world.y });
    const { column: down_cell_x, row: down_cell_y } = gridOffsets.getRowColumnFromWorld(world.x, world.y);

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
    const canvas = document.querySelector('#QuadraticCanvasID') as HTMLCanvasElement;
    if (canvas) {
      const headingResize = intersectsHeadingGridLine(world);
      if (headingResize) {
        canvas.style.cursor = headingResize.column !== undefined ? "col-resize" : "row-resize";
      } else {
        canvas.style.cursor = intersectsHeadings(world) ? 'pointer' : 'auto';
      }
    }
  };

  const pointerMoveResize = (world: PIXI.Point): void => {
    const downResize = props.headingResizing;
    if (!downResize) return;
    if (downResize.column !== undefined) {
      const size = Math.max(0, world.x - downResize.start);
      if (size !== downResize.width) {
        props.setHeadingResizing({ ...downResize, width: size });
      }
    } else if (downResize.row !== undefined) {
      const size = Math.max(0, world.y - downResize.start);
      if (size !== downResize.height) {
        props.setHeadingResizing({ ...downResize, height: size });
      }
    }
  };

  const onPointerMove = (world: PIXI.Point, _: PointerEvent): void => {
    // if no viewport ref, don't do anything. Something went wrong, this shouldn't happen.
    if (props.viewportRef.current === undefined) return;

    if (props.headingResizing) {
      pointerMoveResize(world);
      return;
    }
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
    const { column: move_cell_x, row: move_cell_y } = gridOffsets.getRowColumnFromWorld(world.x, world.y);

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
    if (props.headingResizing) {
      props.saveHeadingResizing();
    } else if (downPosition && !pointerMoved) {
      const timeout = window.setTimeout(() => setDoubleClickTimeout(undefined), DOUBLE_CLICK_TIME);
      setDoubleClickTimeout(timeout);
    }
    props.setHeadingResizing(undefined);
    setDownPosition(undefined);
    setPreviousPosition(undefined);
  };

  return {
    isDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};
