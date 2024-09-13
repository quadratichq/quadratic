import { events } from '@/app/events/events';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { sheets } from '../../../grid/controller/Sheets';
import { inlineEditorMonaco } from '../../HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { doubleClickCell } from './doubleClickCell';
import { DOUBLE_CLICK_TIME } from './pointerUtils';

const MINIMUM_MOVE_POSITION = 5;

export class PointerDown {
  active = false;

  private positionRaw?: Point;
  private position?: Point;
  private previousPosition?: Point;
  private pointerMoved = false;
  private doubleClickTimeout?: number;

  // flag that ensures that if pointerUp triggers during setTimeout, pointerUp is still called (see below)
  private afterShowInput?: boolean;

  // Determines whether the input is valid (ie, whether it is open and has a value that does not fail validation)
  private async isInputValid(): Promise<boolean> {
    const location = inlineEditorHandler.location;
    if (!location || !inlineEditorHandler.isOpen()) return true;
    const validationError = await inlineEditorHandler.validateInput();
    if (validationError) {
      events.emit('hoverCell', {
        x: location.x,
        y: location.y,
        validationId: validationError,
        value: inlineEditorMonaco.get(),
      });
      inlineEditorMonaco.focus();
      return false;
    }
    return true;
  }

  async pointerDown(world: Point, event: PointerEvent) {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event.button === 1) return;
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    this.positionRaw = world;
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);

    const rightClick = event.button === 2 || (event.button === 0 && event.ctrlKey);

    // If right click and we have a multi cell selection.
    // If the user has clicked inside the selection.
    if (rightClick) {
      if (!cursor.includesCell(column, row)) {
        cursor.changePosition({
          cursorPosition: { x: column, y: row },
          multiCursor: null,
          ensureVisible: false,
        });
        // hack to ensure that the context menu opens after the cursor changes
        // position (otherwise it may close immediately)
        setTimeout(() => events.emit('gridContextMenu', world, column, row));
      } else {
        events.emit('gridContextMenu', world, column, row);
      }
      return;
    }

    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
      if (!(await this.isInputValid())) return;

      if (this.previousPosition && column === this.previousPosition.x && row === this.previousPosition.y) {
        // ignore right click
        if (rightClick) {
          return;
        }
        event.preventDefault();
        const code = await quadraticCore.getCodeCell(sheet.id, column, row);
        if (code) {
          doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
        } else {
          const cell = await quadraticCore.getEditCell(sheets.sheet.id, column, row);
          doubleClickCell({ column, row, cell });
        }
        this.active = false;
        return;
      }
    }

    // Select cells between pressed and cursor position. Uses last multiCursor
    // or creates a multiCursor.
    if (event.shiftKey) {
      // do nothing if we have text is invalid in the input
      if (!(await this.isInputValid())) return;

      const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);
      const cursorPosition = cursor.cursorPosition;
      if (column !== cursorPosition.x || row !== cursorPosition.y) {
        // make origin top left, and terminal bottom right
        const originX = cursorPosition.x < column ? cursorPosition.x : column;
        const originY = cursorPosition.y < row ? cursorPosition.y : row;
        const termX = cursorPosition.x > column ? cursorPosition.x : column;
        const termY = cursorPosition.y > row ? cursorPosition.y : row;
        const newRectangle = new Rectangle(originX, originY, termX - originX + 1, termY - originY + 1);

        if (cursor.multiCursor?.length) {
          const multiCursor = [...cursor.multiCursor];
          multiCursor[multiCursor.length - 1] = newRectangle;
          cursor.changePosition({
            columnRow: event.metaKey || event.ctrlKey ? undefined : null,
            keyboardMovePosition: { x: column, y: row },
            multiCursor,
            ensureVisible: false,
          });
        } else {
          cursor.changePosition({
            keyboardMovePosition: { x: column, y: row },
            multiCursor: [newRectangle],
            ensureVisible: false,
          });
        }
      }
      this.active = true;
      this.position = new Point(cursorPosition.x, cursorPosition.y);
      this.previousPosition = new Point(column, row);
      this.pointerMoved = false;
      return;
    }

    // select another multiCursor range
    if (!this.active && (event.metaKey || event.ctrlKey)) {
      if (!(await this.isInputValid())) return;

      const cursorPosition = cursor.cursorPosition;
      if (cursor.multiCursor || column !== cursorPosition.x || row !== cursorPosition.y) {
        event.stopPropagation();
        const multiCursor = cursor.multiCursor ?? [new Rectangle(cursorPosition.x, cursorPosition.y, 1, 1)];
        multiCursor.push(new Rectangle(column, row, 1, 1));
        cursor.changePosition({
          cursorPosition: { x: column, y: row },
          multiCursor,
          ensureVisible: false,
        });
        this.active = true;
        this.position = new Point(column, row);

        // Keep track of multiCursor previous position
        this.previousPosition = new Point(column, row);

        this.pointerMoved = false;
        return;
      }
    }

    this.active = true;
    this.position = new Point(column, row);

    // Keep track of multiCursor previous position
    this.previousPosition = new Point(column, row);

    // Move cursor to mouse down position
    // For single click, hide multiCursor

    // If the input is rejected, we cannot move the cursor
    if (await inlineEditorHandler.handleCellPointerDown()) {
      cursor.changePosition({
        keyboardMovePosition: { x: column, y: row },
        cursorPosition: { x: column, y: row },
        multiCursor:
          (event.metaKey || event.ctrlKey) && cursor.multiCursor
            ? cursor.multiCursor.slice(0, cursor.multiCursor.length - 1)
            : null,
        columnRow: event.metaKey || event.ctrlKey ? cursor.columnRow : null,
        ensureVisible: false,
      });
    } else {
      inlineEditorMonaco.focus();
    }
    events.emit('clickedToCell', column, row, world);
    this.pointerMoved = false;
  }

  pointerMove(world: Point, event: PointerEvent): void {
    if (pixiAppSettings.panMode !== PanMode.Disabled) return;

    if (!this.active) return;

    const { viewport } = pixiApp;
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    if (!this.pointerMoved && this.positionRaw) {
      if (
        Math.abs(this.positionRaw.x - world.x) + Math.abs(this.positionRaw.y - world.y) >
        MINIMUM_MOVE_POSITION / viewport.scale.x
      ) {
        this.pointerMoved = true;
        this.clearDoubleClick();
      }
    }

    // cursor intersects bottom-corner indicator (disabled for now)
    if (!this.active || !this.position || !this.previousPosition || !this.positionRaw) {
      return;
    }

    // calculate mouse move position
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);

    const columnRow = event.metaKey || event.ctrlKey ? undefined : null;

    // cursor start and end in the same cell
    if (column === this.position.x && row === this.position.y) {
      // hide multi cursor when only selecting one cell
      if (cursor.multiCursor && cursor.multiCursor.length === 1) {
        cursor.changePosition({
          columnRow,
          keyboardMovePosition: { x: this.position.x, y: this.position.y },
          cursorPosition: { x: this.position.x, y: this.position.y },
          ensureVisible: false,
        });
      }
      this.previousPosition = new Point(this.position.x, this.position.y);
      if (inlineEditorHandler.isOpen() && !inlineEditorHandler.isEditingFormula()) {
        pixiAppSettings.changeInput(false);
      }
    } else {
      // cursor origin and terminal are not in the same cell

      // make origin top left, and terminal bottom right
      const originX = this.position.x < column ? this.position.x : column;
      const originY = this.position.y < row ? this.position.y : row;
      const termX = this.position.x > column ? this.position.x : column;
      const termY = this.position.y > row ? this.position.y : row;

      // determine if the cursor has moved from the previous event
      const hasMoved = !(this.previousPosition.x === column && this.previousPosition.y === row);

      // only set state if changed
      // this reduces the number of hooks fired
      if (hasMoved) {
        // update multiCursor
        const multiCursor = cursor.multiCursor ? cursor.multiCursor.slice(0, cursor.multiCursor.length - 1) : [];
        multiCursor.push(new Rectangle(originX, originY, termX - originX + 1, termY - originY + 1));
        cursor.changePosition({
          columnRow,
          keyboardMovePosition: { x: column, y: row },
          cursorPosition: { x: this.position.x, y: this.position.y },
          multiCursor,
          ensureVisible: false,
        });
        if (inlineEditorHandler.isOpen() && !inlineEditorHandler.isEditingFormula()) {
          pixiAppSettings.changeInput(false);
        }

        // update previousPosition
        this.previousPosition = new Point(column, row);
      }
    }
  }

  pointerUp(): void {
    if (this.afterShowInput) {
      window.setTimeout(() => this.pointerUp(), 0);
      this.afterShowInput = false;
      return;
    }
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
