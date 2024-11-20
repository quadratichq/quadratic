import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
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
  startCell?: Point;
  movingCells?: MoveCells;
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

    if (this.state === 'hover' && this.movingCells && event.button === 0) {
      this.state = 'move';
      this.startCell = new Point(this.movingCells.column, this.movingCells.row);
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
    this.movingCells = undefined;
    if (this.state === 'move') {
      pixiApp.cellMoving.dirty = true;
      events.emit('cellMoving', false);
      pixiApp.viewport.plugins.remove('mouse-edges');
    }
    this.state = undefined;
    this.startCell = undefined;
  }

  private pointerMoveMoving(world: Point) {
    if (this.state !== 'move' || !this.movingCells) {
      throw new Error('Expected moving to be defined in pointerMoveMoving');
    }
    const sheet = sheets.sheet;
    const position = sheet.getColumnRowFromScreen(world.x, world.y);
    this.movingCells.toColumn = position.column + this.movingCells.offset.x;
    this.movingCells.toRow = position.row + this.movingCells.offset.y;
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

    const origin = sheet.cursor.position;
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
      this.movingCells = {
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
    } else if (event.buttons === 0) {
      return this.pointerMoveHover(world);
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.state === 'move') {
      if (this.startCell === undefined) {
        throw new Error('[PointerCellMoving] Expected startCell to be defined in pointerUp');
      }
      if (
        this.movingCells &&
        (this.startCell.x !== this.movingCells.toColumn || this.startCell.y !== this.movingCells.toRow)
      ) {
        const rectangle = sheets.sheet.cursor.getLargestRectangle();
        quadraticCore.moveCells(
          rectToSheetRect(rectangle, sheets.sheet.id),
          this.movingCells.toColumn,
          this.movingCells.toRow,
          sheets.sheet.id
        );

        const { showCodeEditor, codeCell } = pixiAppSettings.codeEditorState;
        if (
          showCodeEditor &&
          codeCell.sheetId === sheets.current &&
          intersects.rectanglePoint(rectangle, new Point(codeCell.pos.x, codeCell.pos.y))
        ) {
          pixiAppSettings.setCodeEditorState?.({
            ...pixiAppSettings.codeEditorState,
            codeCell: {
              ...codeCell,
              pos: {
                x: codeCell.pos.x + this.movingCells.toColumn - this.movingCells.column,
                y: codeCell.pos.y + this.movingCells.toRow - this.movingCells.row,
              },
            },
          });
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
