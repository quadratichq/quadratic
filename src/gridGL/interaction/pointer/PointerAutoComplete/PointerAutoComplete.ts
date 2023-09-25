import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { intersects } from '../../../helpers/intersects';
import { pixiApp } from '../../../pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '../../../pixiApp/PixiAppSettings';
import { Coordinate } from '../../../types/size';

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
      this.screenSelection = sheet.gridOffsets.getScreenRectangle(
        this.selection.left,
        this.selection.top,
        this.selection.width + 1,
        this.selection.height + 1
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
        const { column, row } = sheets.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);
        const { selection, screenSelection } = this;
        if (!selection || !screenSelection) {
          throw new Error('Expected selection and screenSelection to be defined');
        }
        this.endCell = { x: column, y: row };
        const rectangle = new Rectangle(selection.x, selection.y, selection.width + 1, selection.height + 1);
        const deleteRectangles = [];
        if (row === selection.top && selection.top === selection.bottom) {
          this.toVertical = undefined;
          this.stateVertical = undefined;
        } else if (row >= selection.top && row < selection.bottom) {
          this.stateVertical = 'shrink';
          this.toVertical = row;
          rectangle.height = row - selection.top + 1;
          deleteRectangles.push(new Rectangle(selection.x, row + 1, selection.width + 1, selection.bottom - row));
        } else if (row < selection.top) {
          this.stateVertical = 'expandUp';
          this.toVertical = row;
          rectangle.y = row;
          rectangle.height = selection.bottom - row + 1;
        } else if (row > selection.bottom) {
          this.stateVertical = 'expandDown';
          this.toVertical = row;
          rectangle.height = row - selection.y + 1;
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
          rectangle.width = column - selection.left + 1;
          if (this.stateVertical === 'shrink') {
            deleteRectangles.push(
              new Rectangle(column + 1, selection.y, selection.right - column, row - selection.y + 1)
            );
          } else {
            deleteRectangles.push(
              new Rectangle(column + 1, selection.y, selection.right - column, selection.height + 1)
            );
          }
        } else if (column < selection.left) {
          this.stateHorizontal = 'expandLeft';
          this.toHorizontal = column;
          rectangle.x = column;
          rectangle.width = selection.right - column + 1;
        } else if (column > selection.right) {
          this.stateHorizontal = 'expandRight';
          this.toHorizontal = column;
          rectangle.width = column - selection.x + 1;
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
      });
    }
  }

  private async apply(): Promise<void> {
    if (!this.selection) return;

    const sheet = sheets.sheet;

    if (this.endCell) {
      const range = new Rectangle(
        this.selection.x,
        this.selection.y,
        this.endCell.x - this.selection.x,
        this.endCell.y - this.selection.y
      );
      grid.expand(sheet.id, this.selection, range, this.stateHorizontal === 'shrink' ? this.toHorizontal : undefined);
    }

    if (!this.stateHorizontal && !this.stateVertical) {
      this.reset();
      return;
    }

    if (this.stateVertical === 'shrink') {
      if (this.endCell) {
        const rect = new Rectangle(
          this.selection.left,
          this.endCell.y + 1,
          this.selection.right,
          this.selection.bottom
        );
        grid.deleteCellValues(sheet.id, rect, false);
      }
    } else if (this.stateVertical === 'expandDown' && this.toVertical !== undefined) {
      // if (!(this.stateHorizontal === 'expandRight' && this.toHorizontal !== undefined)) {
      // grid.expandDown(
      //   sheet.id,
      //   this.selection,
      //   this.toVertical,
      //   this.stateHorizontal === 'shrink' ? this.toHorizontal : undefined
      // );
      // }
    } else if (this.stateVertical === 'expandUp' && this.toVertical !== undefined) {
      // grid.expandUp(
      //   sheet.id,
      //   this.selection,
      //   this.toVertical,
      //   this.stateHorizontal === 'shrink' ? this.toHorizontal : undefined
      // );
    }

    if (this.stateHorizontal === 'shrink') {
      if (this.endCell) {
        const rect = new Rectangle(this.endCell.x + 1, this.selection.top, this.selection.right, this.selection.bottom);
        grid.deleteCellValues(sheet.id, rect, false);
      }
    } else if (this.stateHorizontal === 'expandLeft' && this.toHorizontal !== undefined) {
      // grid.expandLeft(sheet.id, this.selection, this.toHorizontal, this.toVertical);
    } else if (this.stateHorizontal === 'expandRight' && this.toHorizontal !== undefined) {
      console.log(sheet.id, this.selection, this.toHorizontal, this.toVertical);
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
