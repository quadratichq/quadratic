import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
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

  // Completes the move
  private completeMove() {
    if (this.state !== 'move' || !this.moving) {
      throw new Error('Expected moving to be defined in completeMove');
    }
    quadraticCore.moveCells(
      this.moving.column,
      this.moving.row,
      this.moving.width,
      this.moving.height,
      sheets.sheet.id,
      this.moving.toColumn,
      this.moving.toRow,
      sheets.sheet.id
    );
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
    const offsets = sheets.sheet.offsets;
    const position = offsets.getColumnRowFromScreen(world.x + this.moving.offset.x, world.y + this.moving.offset.y);
    if (this.moving.toColumn !== position.column || this.moving.toRow !== position.row) {
      this.moving.toColumn = position.column;
      this.moving.toRow = position.row;
      pixiApp.cellMoving.dirty = true;
    }
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
    const origin = sheet.cursor.originPosition;
    const column = origin.x;
    const row = origin.y;

    const overlap = this.moveOverlaps(world);
    if (overlap) {
      this.state = 'hover';
      const rectangle = sheet.cursor.getRectangle();
      const screenRectangle = pixiApp.cursor.cursorRectangle;
      if (!screenRectangle) return false;
      let adjustX = 0,
        adjustY = 0;
      if (overlap === 'right') {
        adjustX = sheets.sheet.offsets.getColumnWidth(rectangle.right);
      } else if (overlap === 'bottom') {
        adjustY = sheets.sheet.offsets.getRowHeight(rectangle.bottom);
      }
      this.moving = {
        column,
        row,
        width: rectangle.width,
        height: rectangle.height,
        toColumn: column,
        toRow: row,
        offset: {
          x: screenRectangle.x - world.x + adjustX,
          y: screenRectangle.y - world.y + adjustY,
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
      this.completeMove();
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
