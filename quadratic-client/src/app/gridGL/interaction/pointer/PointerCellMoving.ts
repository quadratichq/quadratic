import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { rectToSheetRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Point, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { isMobile } from 'react-device-detect';

// Distance from top left corner to trigger a cell move.
const TOP_LEFT_CORNER_THRESHOLD_SQUARED = 50;
const BORDER_THRESHOLD = 8;

interface MoveCells {
  column?: number;
  row?: number;
  width?: number;
  height?: number;
  toColumn?: number;
  toRow?: number;
  offset: { x: number; y: number };
  original?: Rectangle;
  colRows?: 'columns' | 'rows';
}

export class PointerCellMoving {
  private startCell?: Point;
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

  private startMove = () => {
    this.state = 'move';
    events.emit('cellMoving', true);
    pixiApp.viewport.enableMouseEdges();
    htmlCellsHandler.disable();
  };

  // Starts a table move.
  tableMove = (column: number, row: number, point: Point, width: number, height: number) => {
    if (this.state) return false;
    this.startCell = new Point(column, row);
    const offset = sheets.sheet.getColumnRowFromScreen(point.x, point.y);
    this.movingCells = {
      column,
      row,
      width,
      height,
      toColumn: column,
      toRow: row,
      offset: { x: column - offset.column, y: row - offset.row },
      original: new Rectangle(column, row, width, height),
    };
    this.startMove();
  };

  pointerDown = (e: FederatedPointerEvent): boolean => {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || e.button === 1) return false;

    if (this.state === 'hover' && this.movingCells && e.button === 0) {
      this.startCell = new Point(this.movingCells.column, this.movingCells.row);
      this.startMove();
      return true;
    }
    return false;
  };

  private reset = () => {
    this.movingCells = undefined;
    if (this.state === 'move') {
      pixiApp.cellMoving.dirty = true;
      events.emit('cellMoving', false);
      pixiApp.viewport.disableMouseEdges();
      htmlCellsHandler.enable();
    }
    this.state = undefined;
    this.startCell = undefined;
  };

  private pointerMoveMoving = (world: Point) => {
    if (this.state !== 'move' || !this.movingCells) {
      throw new Error('Expected moving to be defined in pointerMoveMoving');
    }
    pixiApp.viewport.enableMouseEdges();
    const sheet = sheets.sheet;
    const position = sheet.getColumnRowFromScreen(world.x, world.y);
    this.movingCells.toColumn = Math.max(1, position.column + this.movingCells.offset.x);
    this.movingCells.toRow = Math.max(1, position.row + this.movingCells.offset.y);
    pixiApp.cellMoving.dirty = true;
  };

  // Checks if mouse overlaps the selection rectangle. We do not check the
  // top/bottom when columns are selected, and left/right when rows are
  // selected. We also ignore the indicator and the corner when cols or rows are
  // selected. (Cols/rows means the entire column or row.)
  private moveOverlaps = (
    world: Point,
    cols: boolean,
    rows: boolean
  ): false | 'corner' | 'top' | 'bottom' | 'left' | 'right' => {
    const cursorRectangle = pixiApp.cursor.cursorRectangle;
    if (!cursorRectangle) return false;

    // top-left corner + threshold
    if (!cols && !rows) {
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
    }

    if (!rows) {
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
    }

    // top/bottom i
    if (!cols) {
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
    }

    return false;
  };

  private pointerMoveHover = (world: Point): boolean => {
    // we move if a single rectangle
    let rectangle = sheets.sheet.cursor.getSingleRectangleOrCursor();

    // also move if contiguous columns or rows
    let colsHover, rowsHover;
    if (!rectangle) {
      colsHover = sheets.sheet.cursor.getContiguousColumns();
      if (!colsHover) {
        rowsHover = sheets.sheet.cursor.getContiguousRows();
      }
    }
    if (!rectangle && !colsHover && !rowsHover) return false;
    if (!rectangle) {
      if (colsHover) {
        rectangle = new Rectangle(
          colsHover[0],
          1,
          colsHover[colsHover.length - 1] - colsHover[0] + 1,
          sheets.sheet.bounds.type === 'nonEmpty' ? Number(sheets.sheet.bounds.max.y) : 1
        );
      } else if (rowsHover) {
        rectangle = new Rectangle(
          1,
          rowsHover[0],
          sheets.sheet.bounds.type === 'nonEmpty' ? Number(sheets.sheet.bounds.max.x) : 1,
          rowsHover[rowsHover.length - 1] - rowsHover[0] + 1
        );
      }
    }
    if (!rectangle) return false;

    const column = rectangle.left;
    const row = rectangle.top;

    const overlap = this.moveOverlaps(world, !!colsHover, !!rowsHover);
    if (overlap) {
      this.state = 'hover';
      const screenRectangle = pixiApp.cursor.cursorRectangle;
      if (!screenRectangle) return false;

      // the offset is the clamped value of the rectangle based on where the user clicks
      const offset = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
      offset.column = Math.min(Math.max(offset.column, rectangle.left), rectangle.right - 1);
      offset.row = Math.min(Math.max(offset.row, rectangle.top), rectangle.bottom - 1);
      this.movingCells = {
        column: rowsHover ? undefined : column,
        row: colsHover ? undefined : row,
        width: rowsHover ? undefined : rectangle.width,
        height: colsHover ? undefined : rectangle.height,
        toColumn: rowsHover ? undefined : column,
        toRow: colsHover ? undefined : row,
        offset: {
          x: rectangle.left - offset.column,
          y: rectangle.top - offset.row,
        },
        colRows: colsHover ? 'columns' : rowsHover ? 'rows' : undefined,
      };
      return true;
    }
    this.reset();
    return false;
  };

  pointerMove = (world: Point, event: FederatedPointerEvent): boolean => {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event.button === 1) return false;

    if (this.state === 'move') {
      this.pointerMoveMoving(world);
      return true;
    } else if (event.buttons === 0) {
      return this.pointerMoveHover(world);
    }
    return false;
  };

  pointerUp = (): boolean => {
    if (this.state === 'move') {
      if (this.startCell === undefined) {
        throw new Error('[PointerCellMoving] Expected startCell to be defined in pointerUp');
      }
      if (
        this.movingCells &&
        (this.startCell.x !== this.movingCells.toColumn || this.startCell.y !== this.movingCells.toRow)
      ) {
        const rectangle = new Rectangle(
          this.movingCells.column ?? 0,
          this.movingCells.row ?? 0,
          this.movingCells.width ?? 1,
          this.movingCells.height ?? 1
        );
        quadraticCore.moveCells(
          rectToSheetRect(rectangle, sheets.current),
          this.movingCells.toColumn ?? 0,
          this.movingCells.toRow ?? 0,
          sheets.current,
          this.movingCells.colRows ? this.movingCells.colRows === 'columns' : false,
          this.movingCells.colRows ? this.movingCells.colRows === 'rows' : false
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
                x: codeCell.pos.x + (this.movingCells.toColumn ?? 0) - (this.movingCells.column ?? 0),
                y: codeCell.pos.y + (this.movingCells.toRow ?? 0) - (this.movingCells.row ?? 0),
              },
            },
          });
        }
      }
      this.reset();
      return true;
    }
    return false;
  };

  handleEscape = (): boolean => {
    if (this.state === 'move') {
      this.reset();
      return true;
    }
    return false;
  };
}
