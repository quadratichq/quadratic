import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { rectToSheetRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';

// Distance from top left corner to trigger a cell move.
const TOP_LEFT_CORNER_THRESHOLD_SQUARED = 50;
const BORDER_THRESHOLD = 8;

// Speed when turning on the mouseEdges plugin for pixi-viewport
const MOUSE_EDGES_SPEED = 8;
const MOUSE_EDGES_DISTANCE = 20;

interface MoveCells {
  column: number;
  row: number;
  width: number;
  height: number;
  toColumn: number;
  toRow: number;
  offset: { x: number; y: number };
}

export class PointerCellMoving {
  moving?: MoveCells;
  state?: 'hover' | 'move';

  get cursor(): string | undefined {
    switch (this.state) {
      case 'move':
        return 'grabbing';
      case 'hover':
        return 'grab';
      default:
        return undefined;
    }
  }

  findCorner(world: Point): Point {
    return world;
  }
  pointerDown(event: PointerEvent): boolean {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event.button === 1) return false;

    if (this.state === 'hover' && this.moving) {
      this.state = 'move';
      events.emit('cellMoving', true);
      pixiApp.viewport.mouseEdges({
        distance: MOUSE_EDGES_DISTANCE,
        allowButtons: true,
        speed: MOUSE_EDGES_SPEED / pixiApp.viewport.scale.x,
      });
      return true;
    }
    return false;
  }

  private reset() {
    this.moving = undefined;
    if (this.state === 'move') {
      pixiApp.cellMoving.dirty = true;
      events.emit('cellMoving', false);
      pixiApp.viewport.plugins.remove('mouse-edges');
    }
    this.state = undefined;
  }

  private pointerMoveMoving(world: Point) {
    if (this.state !== 'move' || !this.moving) {
      throw new Error('Expected moving to be defined in pointerMoveMoving');
    }
    const sheet = sheets.sheet;
    const position = sheet.getColumnRowFromScreen(world.x, world.y);
    this.moving.toColumn = position.column + this.moving.offset.x;
    this.moving.toRow = position.row + this.moving.offset.y;
    pixiApp.cellMoving.dirty = true;
  }

  private moveOverlaps(world: Point): false | 'corner' | 'top' | 'bottom' | 'left' | 'right' {
    const cursorRectangle = pixiApp.cursor.cursorRectangle;
    if (!cursorRectangle) return false;

    // top-left corner + threshold
    if (
      Math.pow(cursorRectangle.x - world.x, 2) + Math.pow(cursorRectangle.y - world.y, 2) <=
      TOP_LEFT_CORNER_THRESHOLD_SQUARED
    ) {
      return 'corner';
    }

    // if overlap indicator (autocomplete), then return false
    const indicator = pixiApp.cursor.indicator;
    if (intersects.rectanglePoint(indicator, world)) {
      return false;
    }

    // if overlaps any of the borders (with threshold), then return true
    const left = new Rectangle(
      cursorRectangle.x - BORDER_THRESHOLD / 2,
      cursorRectangle.y,
      BORDER_THRESHOLD,
      cursorRectangle.height
    );
    if (intersects.rectanglePoint(left, world)) {
      return 'left';
    }

    const right = new Rectangle(
      cursorRectangle.x + cursorRectangle.width - BORDER_THRESHOLD / 2,
      cursorRectangle.y,
      BORDER_THRESHOLD,
      cursorRectangle.height
    );
    if (intersects.rectanglePoint(right, world)) {
      return 'right';
    }

    const top = new Rectangle(
      cursorRectangle.x,
      cursorRectangle.y - BORDER_THRESHOLD / 2,
      cursorRectangle.width,
      BORDER_THRESHOLD
    );
    if (intersects.rectanglePoint(top, world)) {
      return 'top';
    }
    const bottom = new Rectangle(
      cursorRectangle.x,
      cursorRectangle.y + cursorRectangle.height - BORDER_THRESHOLD / 2,
      cursorRectangle.width,
      BORDER_THRESHOLD
    );

    if (intersects.rectanglePoint(bottom, world)) {
      return 'bottom';
    }

    return false;
  }

  private pointerMoveHover(world: Point): boolean {
    const sheet = sheets.sheet;
    const rectangles = sheet.cursor.getRectangles();

    // we do not move if there are multiple rectangles (for now)
    if (rectangles.length > 1) return false;
    const rectangle = rectangles[0];

    const origin = sheet.cursor.getCursor();
    const column = origin.x;
    const row = origin.y;

    const overlap = this.moveOverlaps(world);
    if (overlap) {
      this.state = 'hover';
      const screenRectangle = pixiApp.cursor.cursorRectangle;
      if (!screenRectangle) return false;

      // the offset is the clamped value of the rectangle based on where the user clicks
      const offset = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
      offset.column = Math.min(Math.max(offset.column, rectangle.left), rectangle.right);
      offset.row = Math.min(Math.max(offset.row, rectangle.top), rectangle.bottom);
      this.moving = {
        column,
        row,
        width: rectangle.width,
        height: rectangle.height,
        toColumn: column,
        toRow: row,
        offset: {
          x: rectangle.left - offset.column,
          y: rectangle.top - offset.row,
        },
      };
      return true;
    }
    this.reset();
    return false;
  }

  pointerMove(event: PointerEvent, world: Point): boolean {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event.button === 1) return false;

    if (this.state === 'move') {
      this.pointerMoveMoving(world);
      return true;
    } else {
      return this.pointerMoveHover(world);
    }
  }

  pointerUp(): boolean {
    if (this.state === 'move') {
      if (this.moving) {
        const rectangle = sheets.sheet.cursor.getLargestMultiCursorRectangle();
        quadraticCore.moveCells(
          rectToSheetRect(
            new Rectangle(rectangle.x, rectangle.y, rectangle.width - 1, rectangle.height - 1),
            sheets.sheet.id
          ),
          this.moving.toColumn,
          this.moving.toRow,
          sheets.sheet.id
        );

        // if we moved the code cell, we need to repopulate the code editor with
        // unsaved content.
        if (pixiAppSettings.unsavedEditorChanges) {
          const state = pixiAppSettings.editorInteractionState;
          if (
            state.selectedCellSheet === sheets.sheet.id &&
            intersects.rectanglePoint(rectangle, new Point(state.selectedCell.x, state.selectedCell.y))
          ) {
            pixiAppSettings.setEditorInteractionState?.({
              ...pixiAppSettings.editorInteractionState,
              initialCode: pixiAppSettings.unsavedEditorChanges,
              selectedCell: {
                x: state.selectedCell.x + this.moving.toColumn - this.moving.column,
                y: state.selectedCell.y + this.moving.toRow - this.moving.row,
              },
            });
          }
        }
      }
      this.reset();
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.state === 'move') {
      this.reset();
      return true;
    }
    return false;
  }
}
