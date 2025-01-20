import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isLinux } from '@/shared/utils/isLinux';
import { isMac } from '@/shared/utils/isMac';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';

const MINIMUM_MOVE_POSITION = 5;

export class PointerDown {
  active = false;

  private positionRaw?: Point;
  private position?: Point;
  private previousPosition?: Point;
  private pointerMoved = false;
  private doubleClickTimeout?: number;

  // used to track the unselect rectangle
  unselectDown?: Rectangle;

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
        cursor.moveTo(column, row, false);
        // hack to ensure that the context menu opens after the cursor changes
        // position (otherwise it may close immediately)
        setTimeout(() => events.emit('contextMenu', { type: ContextMenuType.Grid, world, column, row }));
      } else {
        events.emit('contextMenu', { type: ContextMenuType.Grid, world, column, row });
      }
      return;
    }

    if (this.doubleClickTimeout) {
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
      if (!(await this.isInputValid())) return;

      if (this.previousPosition && column === this.previousPosition.x && row === this.previousPosition.y) {
        // ignore right click
        if (isRightClick) {
          return;
        }
        event.preventDefault();
        const table = pixiApp.cellsSheet().tables.getTableFromTableCell(column, row);
        if (table) {
          doubleClickCell({
            column: table.codeCell.x,
            row: table.codeCell.y,
            language: table.codeCell.language,
            cell: '',
          });
        } else {
          const cell = await quadraticCore.getEditCell(sheets.sheet.id, column, row);
          doubleClickCell({ column, row, cell, cursorMode: cell ? CursorMode.Edit : CursorMode.Enter });
        }
        this.active = false;
        return;
      }
    }
    // do nothing if we have text is invalid in the input
    if (!(await this.isInputValid())) return;

    if ((event.ctrlKey || event.metaKey) && cursor.contains(column, row)) {
      this.unselectDown = new Rectangle(column, row, 0, 0);
      pixiApp.cursor.dirty = true;
      return;
    }

    // If the user is holding cmd/ctrl and the cell is already selected, then we start the un-selection.
    if (event.shiftKey) {
      cursor.selectTo(column, row, event.metaKey || event.ctrlKey);
    } else {
      // If the input is rejected, we cannot move the cursor
      if (await inlineEditorHandler.handleCellPointerDown()) {
        cursor.moveTo(column, row, event.metaKey || event.ctrlKey);
      } else {
        inlineEditorMonaco.focus();
      }
    }
    this.previousPosition = new Point(column, row);
    events.emit('clickedToCell', column, row, world);
    this.pointerMoved = false;
    this.position = new Point(column, row);
    this.active = true;
  }

  pointerMove(world: Point, event: PointerEvent): void {
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

      pixiApp.cursor.dirty = true;
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
      sheet.cursor.selectTo(column, row, event.ctrlKey || event.metaKey);
      this.previousPosition = new Point(column, row);

      if (inlineEditorHandler.isOpen() && !inlineEditorHandler.isEditingFormula()) {
        pixiAppSettings.changeInput(false);
      }
    }
  }

  pointerUp(event?: PointerEvent): void {
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
      pixiApp.cursor.dirty = true;
      return;
    }

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
