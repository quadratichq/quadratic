import { Point } from 'pixi.js';
import { IS_READONLY_MODE } from '../../../constants/app';
import { Sheet } from '../../../grid/sheet/Sheet';
import { doubleClickCell } from './doubleClickCell';
import { DOUBLE_CLICK_TIME } from './pointerUtils';
import { PanMode } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from 'gridGL/pixiApp/PixiApp';

const MINIMUM_MOVE_POSITION = 5;

export class PointerDown {
  private app: PixiApp;
  active = false;

  private positionRaw?: Point;
  private position?: Point;
  private previousPosition?: { originPosition: Point; terminalPosition: Point };
  private pointerMoved = false;
  private doubleClickTimeout?: number;

  constructor(app: PixiApp) {
    this.app = app;
  }

  get sheet(): Sheet {
    return this.app.sheet;
  }

  /** get world coordinate for the bottom-right of the selected cell to drag the indicator */
  private getEndCell(): Point {
    let endCell: Point;
    const interactionState = this.app.settings.interactionState;
    const gridOffsets = this.app.sheet.gridOffsets;
    if (interactionState.showMultiCursor) {
      const multiCursor = interactionState.multiCursorPosition;
      const cell = gridOffsets.getCell(multiCursor.terminalPosition.x, multiCursor.terminalPosition.y);
      endCell = new Point(cell.x + cell.width - 1, cell.y + cell.height - 1);
    } else {
      const cell = gridOffsets.getCell(interactionState.cursorPosition.x, interactionState.cursorPosition.y);
      endCell = new Point(cell.x + cell.width - 1, cell.y + cell.height - 1);
    }
    return endCell;
  }

  pointerDown(world: Point, event: PointerEvent): void {
    if (IS_READONLY_MODE) return;
    if (this.app.settings.interactionState.panMode !== PanMode.Disabled) return;

    const { settings, cursor } = this.app;
    const { interactionState, setInteractionState } = settings;
    const { gridOffsets } = this.sheet;

    // handle dragging from the corner (disabled for now)
    // if (intersects.rectanglePoint(this.app.cursor.indicator, world)) {
    //   const cursorPosition = interactionState.cursorPosition;
    //   const end = this.getEndCell();
    //   const { column, row } = gridOffsets.getRowColumnFromWorld(end.x, end.y);
    //   const originX = cursorPosition.x < column ? cursorPosition.x : column;
    //   const originY = cursorPosition.y < row ? cursorPosition.y : row;
    //   this.active = true;
    //   this.position = new Point(originX, originY);
    //   this.positionRaw = end;
    //   this.pointerMoved = true;
    //   this.previousPosition = {
    //     originPosition: new Point(originX, originY),
    //     terminalPosition: new Point(column, row),
    //   };
    //   return;
    // }

    this.positionRaw = world;
    const { column, row } = gridOffsets.getRowColumnFromWorld(world.x, world.y);

    const rightClick = event.button === 2 || (event.button === 0 && event.ctrlKey);

    // If right click and we have a multi cell selection.
    // If the user has clicked inside the selection.
    if (!setInteractionState) {
      throw new Error('Expected setInteractionState to be defined');
    }
    if (rightClick && interactionState.showMultiCursor) {
      if (
        column >= interactionState.multiCursorPosition.originPosition.x &&
        column <= interactionState.multiCursorPosition.terminalPosition.x &&
        row >= interactionState.multiCursorPosition.originPosition.y &&
        row <= interactionState.multiCursorPosition.terminalPosition.y
      )
        // Ignore this click. User is accessing the RightClickMenu.
        return;
    }

    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
      if (
        this.previousPosition &&
        column === this.previousPosition.originPosition.x &&
        row === this.previousPosition.originPosition.y
      ) {
        // ignore right click
        if (rightClick) {
          return;
        }
        doubleClickCell({ cell: this.sheet.grid.getCell(column, row), app: this.app });
        this.active = false;
        event.preventDefault();
        return;
      }
    }

    // select cells between pressed and cursor position
    if (event.shiftKey) {
      const { column, row } = gridOffsets.getRowColumnFromWorld(world.x, world.y);
      const cursorPosition = interactionState.cursorPosition;
      if (column !== cursorPosition.x || row !== cursorPosition.y) {
        // make origin top left, and terminal bottom right
        const originX = cursorPosition.x < column ? cursorPosition.x : column;
        const originY = cursorPosition.y < row ? cursorPosition.y : row;
        const termX = cursorPosition.x > column ? cursorPosition.x : column;
        const termY = cursorPosition.y > row ? cursorPosition.y : row;

        setInteractionState({
          ...interactionState,
          keyboardMovePosition: { x: column, y: row },
          multiCursorPosition: {
            originPosition: new Point(originX, originY),
            terminalPosition: new Point(termX, termY),
          },
          showMultiCursor: true,
        });
        cursor.dirty = true;
      }
      return;
    }

    this.active = true;
    this.position = new Point(column, row);

    const previousPosition = {
      originPosition: new Point(column, row),
      terminalPosition: new Point(column, row),
    };

    // Keep track of multiCursor previous position
    this.previousPosition = previousPosition;

    // Move cursor to mouse down position
    // For single click, hide multiCursor
    setInteractionState({
      ...interactionState,
      keyboardMovePosition: { x: column, y: row },
      cursorPosition: { x: column, y: row },
      multiCursorPosition: previousPosition,
      showMultiCursor: false,
    });
    cursor.dirty = true;
    this.pointerMoved = false;
  }

  pointerMove(world: Point): void {
    if (this.app.settings.interactionState.panMode !== PanMode.Disabled) return;

    const { viewport, settings, cursor } = this.app;
    const { gridOffsets } = this.sheet;

    // for determining if double click
    if (!this.pointerMoved && this.doubleClickTimeout && this.positionRaw) {
      if (
        Math.abs(this.positionRaw.x - world.x) + Math.abs(this.positionRaw.y - world.y) >
        MINIMUM_MOVE_POSITION / viewport.scale.x
      ) {
        this.pointerMoved = true;
        this.clearDoubleClick();
      }
    }

    // cursor intersects edges
    // if (
    //   !this.active ||
    //   !this.position ||
    //   !this.previousPosition ||
    //   !this.positionRaw ||
    //   !settings.setInteractionState
    // ) {
    //   if (
    //     Math.abs(this.app.cursor.format_indicator.x - world.x) < 3 ||
    //     Math.abs(this.app.cursor.format_indicator.y - world.y) < 3
    //   ) {
    //     this.app.canvas.style.cursor = 'grab';
    //   }

    // }

    // cursor intersects bottom-corner indicator (disabled for now)
    if (
      !this.active ||
      !this.position ||
      !this.previousPosition ||
      !this.positionRaw ||
      !settings.setInteractionState
    ) {
      // if (intersects.rectanglePoint(this.app.cursor.indicator, world)) {
      //   this.app.canvas.style.cursor = 'cell';
      // }
      return;
    }

    // calculate mouse move position
    const { column, row } = gridOffsets.getRowColumnFromWorld(world.x, world.y);

    // cursor start and end in the same cell
    if (column === this.position.x && row === this.position.y) {
      // hide multi cursor when only selecting one cell
      settings.setInteractionState({
        ...settings.interactionState,
        keyboardMovePosition: { x: this.position.x, y: this.position.y },
        cursorPosition: { x: this.position.x, y: this.position.y },
        multiCursorPosition: {
          originPosition: { x: this.position.x, y: this.position.y },
          terminalPosition: { x: this.position.x, y: this.position.y },
        },
        showMultiCursor: false,
        showInput: false,
        inputInitialValue: '',
      });
    } else {
      // cursor origin and terminal are not in the same cell

      // make origin top left, and terminal bottom right
      const originX = this.position.x < column ? this.position.x : column;
      const originY = this.position.y < row ? this.position.y : row;
      const termX = this.position.x > column ? this.position.x : column;
      const termY = this.position.y > row ? this.position.y : row;

      // determine if the cursor has moved from the previous event
      const hasMoved = !(
        this.previousPosition.originPosition.x === originX &&
        this.previousPosition.originPosition.y === originY &&
        this.previousPosition.terminalPosition.x === termX &&
        this.previousPosition.terminalPosition.y === termY
      );

      // only set state if changed
      // this reduces the number of hooks fired
      if (hasMoved) {
        // update multiCursor
        settings.setInteractionState({
          ...settings.interactionState,
          keyboardMovePosition: { x: column, y: row },
          cursorPosition: { x: this.position.x, y: this.position.y },
          multiCursorPosition: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          showMultiCursor: true,
          showInput: false,
          inputInitialValue: '',
        });
        cursor.dirty = true;

        // update previousPosition
        this.previousPosition = {
          originPosition: new Point(originX, originY),
          terminalPosition: new Point(termX, termY),
        };
      }
    }
  }

  pointerUp(): void {
    if (this.active) {
      if (!this.pointerMoved) {
        this.doubleClickTimeout = window.setTimeout(() => (this.doubleClickTimeout = undefined), DOUBLE_CLICK_TIME);
      }
      this.active = false;
    }
  }

  private clearDoubleClick(): void {
    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
  }

  destroy(): void {
    this.clearDoubleClick();
  }
}
