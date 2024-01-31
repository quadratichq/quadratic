import { multiplayer } from '@/multiplayer/multiplayer';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { grid } from '../../../grid/controller/Grid';
import { sheets } from '../../../grid/controller/Sheets';
import { Bounds } from '../../../grid/sheet/Bounds';
import { intersects } from '../../helpers/intersects';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { Coordinate } from '../../types/size';

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

    // handle dragging from the corner
    if (intersects.rectanglePoint(pixiApp.cursor.indicator, world)) {
      this.active = true;
      if (cursor.multiCursor) {
        this.selection = new Rectangle(
          cursor.multiCursor.originPosition.x,
          cursor.multiCursor.originPosition.y,
          cursor.multiCursor.terminalPosition.x - cursor.multiCursor.originPosition.x,
          cursor.multiCursor.terminalPosition.y - cursor.multiCursor.originPosition.y
        );
      } else {
        this.selection = new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 0, 0);
      }
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

      // handle dragging from the corner
      // if (intersects.rectanglePoint(pixiApp.cursor.indicator, world)) {
      if (this.active) {
        const { column, row } = sheets.sheet.offsets.getColumnRowFromScreen(world.x, world.y);
        const { selection, screenSelection } = this;
        if (!selection || !screenSelection) {
          throw new Error('Expected selection and screenSelection to be defined');
        }
        this.endCell = { x: column, y: row };
        const rectangle = new Rectangle(selection.x, selection.y, selection.width, selection.height);
        const deleteRectangles = [];
        if (row === selection.top && selection.top === selection.bottom) {
          this.toVertical = undefined;
          this.stateVertical = undefined;
        } else if (row >= selection.top && row < selection.bottom) {
          this.stateVertical = 'shrink';
          this.toVertical = row;
          rectangle.height = row - selection.top;
          deleteRectangles.push(new Rectangle(selection.x, row + 1, selection.width, selection.bottom - row - 1));
        } else if (row < selection.top) {
          this.stateVertical = 'expandUp';
          this.toVertical = row;
          rectangle.y = row;
          rectangle.height = selection.bottom - row;
        } else if (row > selection.bottom) {
          this.stateVertical = 'expandDown';
          this.toVertical = row;
          rectangle.height = row - selection.y;
        } else {
          this.stateVertical = undefined;
          this.toVertical = undefined;
        }

        if (column === selection.left && selection.left === selection.right) {
          this.toHorizontal = undefined;
          this.stateHorizontal = undefined;
        } else if (column >= selection.left && column < selection.right) {
          this.stateHorizontal = 'shrink';
          this.toHorizontal = column;
          rectangle.width = column - selection.left;
          if (this.stateVertical === 'shrink') {
            deleteRectangles.push(
              new Rectangle(column + 1, selection.y, selection.right - column - 1, row - selection.y)
            );
          } else {
            deleteRectangles.push(
              new Rectangle(column + 1, selection.y, selection.right - column - 1, selection.height)
            );
          }
        } else if (column < selection.left) {
          this.stateHorizontal = 'expandLeft';
          this.toHorizontal = column;
          rectangle.x = column;
          rectangle.width = selection.right - column;
        } else if (column > selection.right) {
          this.stateHorizontal = 'expandRight';
          this.toHorizontal = column;
          rectangle.width = column - selection.x;
        } else {
          this.stateHorizontal = undefined;
          this.toHorizontal = undefined;
        }
        pixiApp.boxCells.populate({
          gridRectangle: rectangle,
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

  private setSelection(): void {
    const { selection } = this;
    if (!selection) return;

    const top = this.toVertical !== undefined && this.stateVertical === 'expandUp' ? this.toVertical : selection.top;
    const bottom =
      this.toVertical !== undefined && this.stateVertical && ['expandDown', 'shrink'].includes(this.stateVertical)
        ? this.toVertical
        : selection.bottom;
    const left =
      this.toHorizontal !== undefined && this.stateHorizontal === 'expandLeft' ? this.toHorizontal : selection.left;
    const right =
      this.toHorizontal !== undefined &&
      this.stateHorizontal &&
      ['expandRight', 'shrink'].includes(this.stateHorizontal)
        ? this.toHorizontal
        : selection.right;

    const width = bottom - top;
    const height = right - left;

    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    if (width === 1 && height === 1) {
      cursor.changePosition({
        multiCursor: undefined,
      });
    } else {
      sheet.cursor.changePosition({
        multiCursor: {
          originPosition: {
            x: left,
            y: top,
          },
          terminalPosition: {
            x: right,
            y: bottom,
          },
        },
        ensureVisible: false,
      });
    }
  }

  private async apply(): Promise<void> {
    if (!this.selection) return;

    const sheet = sheets.sheet;

    if (this.endCell) {
      const bounds = new Bounds();
      bounds.addRectangle(this.selection);
      bounds.addCoordinate(this.endCell);
      let fullBounds = bounds.toRectangle();

      if (fullBounds) {
        if (this.stateHorizontal === 'shrink') {
          fullBounds.width = this.endCell.x - this.selection.x;
        }

        if (this.stateVertical === 'shrink') {
          fullBounds.height = this.endCell.y - this.selection.y;
        }
        grid.autocomplete(sheet.id, this.selection, fullBounds);
      }
    }

    this.setSelection();
    this.reset();
  }

  pointerUp(): boolean {
    if (this.active) {
      this.apply();
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
