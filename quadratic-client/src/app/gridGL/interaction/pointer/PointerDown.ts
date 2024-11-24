import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isLinux } from '@/shared/utils/isLinux';
import { isMac } from '@/shared/utils/isMac';
import { Point } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { sheets } from '../../../grid/controller/Sheets';
import { inlineEditorMonaco } from '../../HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '../../pixiApp/PixiApp';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
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
        if (isRightClick) {
          return;
        }
        event.preventDefault();
        const code = await quadraticCore.getCodeCell(sheet.id, column, row);
        if (code) {
          doubleClickCell({
            column: Number(code.x),
            row: Number(code.y),
            language: code.language,
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

    if (column === this.previousPosition?.x && row === this.previousPosition?.y) {
      return;
    }
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

    if (!this.active) return;

    const { viewport } = pixiApp;
    const sheet = sheets.sheet;

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
