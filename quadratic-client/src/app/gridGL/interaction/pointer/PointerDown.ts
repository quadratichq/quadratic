import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isLinux } from '@/shared/utils/isLinux';
import { isMac } from '@/shared/utils/isMac';
import { Point, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { isMobile } from 'react-device-detect';

const MINIMUM_MOVE_POSITION = 5;

export class PointerDown {
  active = false;

  private positionRaw?: Point;
  private position?: Point;
  private pointerMoved = false;
  private doubleClickTimeout?: number;

  // the mouse's last column and row
  previousPosition?: Point;

  // the mouse's last column and row when double clicked
  doubleClickPreviousPosition?: Point;

  // used to track the unselect rectangle
  unselectDown?: Rectangle;

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

  async pointerDown(world: Point, event: FederatedPointerEvent) {
    const isMiddleClick = event.button === 1;
    // to prevent default paste behavior on middle click, in Linux
    if (isLinux && isMiddleClick) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event.button === 1) return;
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    this.positionRaw = world;
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);

    const isRightClick = event.button === 2 || (isMac && event.button === 0 && event.ctrlKey);

    // If right click and we have a multi cell selection.
    // If the user has clicked inside the selection.
    if (isRightClick) {
      if (!cursor.contains(column, row)) {
        cursor.moveTo(column, row);
      }
      const codeCell = content.cellsSheet.tables.getCodeCellIntersects({ x: column, y: row });
      if (codeCell && codeCell?.language !== 'Import') {
        events.emit('contextMenu', {
          type: ContextMenuType.Grid,
          world,
          column: codeCell.x,
          row: codeCell.y,
          table: codeCell,
        });
      } else {
        events.emit('contextMenu', {
          type: ContextMenuType.Grid,
          world,
          column,
          row,
          // _could_ have an associated table if it's a cell inside a table on the grid
          table: content.cellsSheet.tables.getCodeCellIntersects(cursor.position),
        });
      }
      return;
    }

    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;

      if (!(await this.isInputValid())) return;

      if (
        this.doubleClickPreviousPosition &&
        column === this.doubleClickPreviousPosition.x &&
        row === this.doubleClickPreviousPosition.y
      ) {
        // ignore right click
        if (isRightClick) {
          return;
        }
        event.preventDefault();
        doubleClickCell({ column, row });
        this.active = false;
        return;
      }
    }
    // do nothing if we have text is invalid in the input
    if (!(await this.isInputValid())) return;

    if ((event.ctrlKey || event.metaKey) && cursor.contains(column, row)) {
      this.unselectDown = new Rectangle(column, row, 0, 0);
      events.emit('setDirty', { cursor: true });
      return;
    }

    // If the user is holding cmd/ctrl and the cell is already selected, then we start the un-selection.
    if (event.shiftKey) {
      cursor.selectTo(column, row, event.metaKey || event.ctrlKey);
    } else {
      // If the input is rejected, we cannot move the cursor
      if (await inlineEditorHandler.handleCellPointerDown()) {
        cursor.moveTo(column, row, { ensureVisible: false, append: event.metaKey || event.ctrlKey });
      } else {
        inlineEditorMonaco.focus();
      }
    }
    this.previousPosition = new Point(column, row);
    this.doubleClickPreviousPosition = new Point(column, row);
    events.emit('clickedToCell', column, row, world);
    this.pointerMoved = false;
    this.position = new Point(column, row);
    this.active = true;
  }

  pointerMove(world: Point, event: FederatedPointerEvent) {
    if (pixiAppSettings.panMode !== PanMode.Disabled) return;

    const { viewport } = pixiApp;
    const sheet = sheets.sheet;

    if (this.unselectDown) {
      const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);
      this.unselectDown.width = column - this.unselectDown.left;
      this.unselectDown.height = row - this.unselectDown.top;

      // this is necessary to ensure the rectangle always has width/height
      if (this.unselectDown.width < 0) this.unselectDown.width -= 1;
      if (this.unselectDown.height < 0) this.unselectDown.height -= 1;

      events.emit('setDirty', { cursor: true });
      return;
    }

    if (!this.active) return;

    if (!this.pointerMoved && this.positionRaw) {
      if (
        Math.abs(this.positionRaw.x - world.x) + Math.abs(this.positionRaw.y - world.y) >
        MINIMUM_MOVE_POSITION / viewport.scale.x
      ) {
        this.pointerMoved = true;
        this.clearDoubleClick();
      } else {
        return;
      }
    }

    // cursor intersects bottom-corner indicator (disabled for now)
    if (!this.active || !this.position || !this.previousPosition || !this.positionRaw) {
      return;
    }

    // calculate mouse move position
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);

    if (column !== this.previousPosition.x || row !== this.previousPosition.y) {
      pixiApp.viewport.enableMouseEdges(world);

      sheet.cursor.selectTo(column, row, event.ctrlKey || event.metaKey, false);
      this.previousPosition = new Point(column, row);

      if (inlineEditorHandler.isOpen() && !inlineEditorHandler.isEditingFormula()) {
        pixiAppSettings.changeInput(false);
      }
    }
  }

  pointerUp(event?: FederatedPointerEvent) {
    const isMiddleClick = event && event.button === 1;
    // to prevent default paste behavior on middle click, in Linux
    if (isLinux && isMiddleClick) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.unselectDown) {
      sheets.sheet.cursor.excludeCells(
        this.unselectDown.left,
        this.unselectDown.top,
        this.unselectDown.right,
        this.unselectDown.bottom
      );
      this.unselectDown = undefined;
      events.emit('setDirty', { cursor: true });
      return;
    }

    if (this.active) {
      if (!this.pointerMoved) {
        this.doubleClickTimeout = window.setTimeout(() => (this.doubleClickTimeout = undefined), DOUBLE_CLICK_TIME);
      }
      this.active = false;
      this.previousPosition = undefined;
      pixiApp.viewport.disableMouseEdges();
    }
  }

  private clearDoubleClick() {
    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
  }

  destroy() {
    this.clearDoubleClick();
  }

  pointerDownColumnName(world: Point, column: number, row: number) {
    this.previousPosition = new Point(column, row);
    this.positionRaw = world;
    this.pointerMoved = false;
    this.position = new Point(column, row);
    this.active = true;
  }
}
