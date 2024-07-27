import { Rectangle } from 'pixi.js';
import type { Point } from 'pixi.js';
import { isMobile } from 'react-device-detect';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { Coordinate } from '@/app/gridGL/types/size';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export type StateVertical = 'expandDown' | 'expandUp' | 'shrink' | undefined;
export type StateHorizontal = 'expandRight' | 'expandLeft' | 'shrink' | undefined;

export class PointerAutoComplete {
  private selection?: Rectangle;
  private endCell?: Coordinate;
  private stateHorizontal: StateHorizontal;
  private stateVertical: StateVertical;
  private toVertical?: number;
  private toHorizontal?: number;
  private screenSelection?: Rectangle;
  cursor?: string;
  active = false;

  pointerDown(world: Point): boolean {
    if (isMobile) return false;

    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    if (pixiAppSettings.panMode !== PanMode.Disabled) return false;

    if (cursor.multiCursor && cursor.multiCursor.length > 1) return false;

    // handle dragging from the corner
    if (intersects.rectanglePoint(pixiApp.cursor.indicator, world)) {
      this.active = true;
      events.emit('cellMoving', true);
      this.selection = cursor.multiCursor
        ? cursor.multiCursor[0]
        : new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1);
      this.screenSelection = sheet.getScreenRectangle(
        this.selection.left,
        this.selection.top,
        this.selection.width,
        this.selection.height
      );
      cursor.changeBoxCells(true);

      return true;
    }
    return false;
  }

  private reset(): void {
    if (this.active) {
      events.emit('cellMoving', false);
      this.stateHorizontal = undefined;
      this.stateVertical = undefined;
      this.endCell = undefined;
      this.toHorizontal = undefined;
      this.toVertical = undefined;
      this.selection = undefined;
      this.screenSelection = undefined;
      this.active = false;
      pixiApp.boxCells.reset();
      sheets.sheet.cursor.changeBoxCells(false);
    }
  }

  pointerMove(world: Point): boolean {
    if (isMobile) return false;
    if (pixiAppSettings.panMode !== PanMode.Disabled) return false;
    if (!this.active) {
      if (intersects.rectanglePoint(pixiApp.cursor.indicator, world)) {
        this.cursor = 'crosshair';
      } else {
        this.cursor = undefined;
      }
      return false;
    } else {
      this.cursor = 'crosshair';

      if (this.active) {
        const { column, row } = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
        let { selection, screenSelection } = this;
        if (!selection || !screenSelection) {
          throw new Error('Expected selection and screenSelection to be defined');
        }

        this.endCell = { x: column, y: row };
        const boxCellsRectangle = selection.clone();
        const deleteRectangles = [];

        // Note: there is weirdness as to the rectangle size because the cell in
        // which the cursor is hovering is where we want to expand/shrink to.
        // This is why there +1s are needed.

        // Handle changes in rows

        // if at bottom or single height then don't do anything
        if (row === selection.bottom - 1 || (row === selection.top && selection.top === selection.bottom)) {
          this.toVertical = undefined;
          this.stateVertical = undefined;
          boxCellsRectangle.height = selection.height - 1;
        }

        // if at top or between top and bottom then we shrink
        else if (row >= selection.top && row + 1 < selection.bottom) {
          this.stateVertical = 'shrink';
          this.toVertical = row;
          boxCellsRectangle.height = row - selection.top;
          deleteRectangles.push(new Rectangle(selection.x, row + 1, selection.width - 1, selection.bottom - row - 2));
        }

        // if above top, then we expand up
        else if (row < selection.top) {
          this.stateVertical = 'expandUp';
          this.toVertical = row;
          boxCellsRectangle.y = row;
          boxCellsRectangle.height = selection.bottom - row - 1;
        }

        // if below bottom, then we expand down
        else if (row >= selection.bottom) {
          this.stateVertical = 'expandDown';
          this.toVertical = row;
          boxCellsRectangle.height = row - selection.y;
        }

        // Handle changes in column

        // if at right or single width then don't do anything
        if (column === selection.right - 1 || (column === selection.left && selection.left === selection.right)) {
          this.toHorizontal = undefined;
          this.stateHorizontal = undefined;
          boxCellsRectangle.width = selection.width - 1;
        }

        // if at left or between left and right then we shrink
        else if (column >= selection.left && column + 1 < selection.right) {
          this.stateHorizontal = 'shrink';
          this.toHorizontal = column;
          boxCellsRectangle.width = column - selection.left;
          deleteRectangles.push(
            new Rectangle(column + 1, selection.y, selection.right - column - 2, row - selection.y)
          );
        }

        // if to the left of the selection then we expand left
        else if (column < selection.left) {
          this.stateHorizontal = 'expandLeft';
          this.toHorizontal = column;
          boxCellsRectangle.x = column;
          boxCellsRectangle.width = selection.right - column - 1;
        }

        // if to the right of the selection then we expand right
        else if (column >= selection.right) {
          this.stateHorizontal = 'expandRight';
          this.toHorizontal = column;
          boxCellsRectangle.width = column - selection.x;
        }

        pixiApp.boxCells.populate({
          gridRectangle: boxCellsRectangle,
          horizontalDelete: this.stateHorizontal === 'shrink',
          verticalDelete: this.stateVertical === 'shrink',
          deleteRectangles,
        });
        multiplayer.sendMouseMove(world.x, world.y);
        return true;
      }
      return false;
    }
  }

  pointerUp(): boolean {
    if (this.active) {
      if (!this.selection) return true;

      const sheet = sheets.sheet;

      if (this.endCell) {
        const newRectangle = this.selection.clone();
        switch (this.stateHorizontal) {
          case 'shrink':
            newRectangle.width = this.endCell.x - this.selection.x + 1;
            break;

          case 'expandRight':
            newRectangle.width = this.endCell.x - this.selection.x + 1;
            break;

          case 'expandLeft':
            newRectangle.x = this.endCell.x;
            newRectangle.width += this.selection.left - this.endCell.x;
            break;
        }

        switch (this.stateVertical) {
          case 'shrink':
            newRectangle.height = this.endCell.y - this.selection.y + 1;
            break;

          case 'expandDown':
            newRectangle.height = this.endCell.y - this.selection.y + 1;
            break;

          case 'expandUp':
            newRectangle.y = this.endCell.y;
            newRectangle.height += this.selection.top - this.endCell.y;
            break;
        }

        if (
          newRectangle.x !== this.selection.x ||
          newRectangle.y !== this.selection.y ||
          newRectangle.width !== this.selection.width ||
          newRectangle.height !== this.selection.height
        ) {
          quadraticCore.autocomplete(
            sheet.id,
            this.selection.left,
            this.selection.top,
            this.selection.right - 1,
            this.selection.bottom - 1,
            newRectangle.left,
            newRectangle.top,
            newRectangle.right - 1,
            newRectangle.bottom - 1
          );
        }

        // update the selection
        const cursor = sheets.sheet.cursor;
        if (newRectangle.width === 1 && newRectangle.height === 1) {
          cursor.changePosition({ columnRow: null, multiCursor: null });
        } else {
          sheet.cursor.changePosition({
            columnRow: null,
            multiCursor: [newRectangle],
            ensureVisible: false,
          });
        }
      }
      this.reset();
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.active) {
      this.reset();
      return true;
    }
    return false;
  }
}
