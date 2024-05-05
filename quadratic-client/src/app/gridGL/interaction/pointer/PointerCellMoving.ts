import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';
import { isMobile } from 'react-device-detect';

// Distance from top left corner to trigger a cell move.
const TOP_LEFT_CORNER_THRESHOLD_SQUARED = 100;

interface MoveCells {
  column: number;
  row: number;
  width: number;
  height: number;
  toColumn: number;
  toRow: number;
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

    if (this.state === 'hover') {
      this.state = 'move';
      events.emit('cellMoving', true);
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
    this.reset();
  }

  private reset() {
    this.moving = undefined;
    if (this.state === 'move') {
      pixiApp.cellMoving.dirty = true;
      events.emit('cellMoving', false);
    }
    this.state = undefined;
  }

  private pointerMoveMoving(world: Point) {
    if (this.state !== 'move' || !this.moving) {
      throw new Error('Expected moving to be defined in pointerMoveMoving');
    }
    const offsets = sheets.sheet.offsets;
    const position = offsets.getColumnRowFromScreen(world.x, world.y);
    if (this.moving.toColumn !== position.column || this.moving.toRow !== position.row) {
      this.moving.toColumn = position.column;
      this.moving.toRow = position.row;
      pixiApp.cellMoving.dirty = true;
    }
  }

  private pointerMoveHover(world: Point): boolean {
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const { column, row } = offsets.getColumnRowFromScreen(world.x, world.y);

    const origin = sheet.cursor.originPosition;

    // if not hovering over current selection, then there's nothing to move
    if (column !== origin.x || row !== origin.y) {
      this.reset();
      return false;
    }

    // Check if we overlap the hit-box: (1) x and y are greater than the corner; (2) distance to the corner is less than the threshold
    const position = offsets.getCellOffsets(column, row);
    if (
      world.x >= position.x &&
      world.y >= position.y &&
      Math.pow(position.x - world.x, 2) + Math.pow(position.y - world.y, 2) <= TOP_LEFT_CORNER_THRESHOLD_SQUARED
    ) {
      this.state = 'hover';
      const rectangle = sheet.cursor.getRectangle();
      this.moving = { column, row, width: rectangle.width, height: rectangle.height, toColumn: column, toRow: row };
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
