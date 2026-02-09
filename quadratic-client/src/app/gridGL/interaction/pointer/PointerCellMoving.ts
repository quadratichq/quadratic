import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { checkMoveDestinationInvalid } from '@/app/gridGL/interaction/pointer/moveInvalid';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { rectToSheetRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Point, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { isMobile } from 'react-device-detect';

// Distance from top left corner to trigger a cell move.
const TOP_LEFT_CORNER_THRESHOLD_SQUARED = 50;
const BORDER_THRESHOLD = 8;

export interface AdditionalTable {
  column: number;
  row: number;
  width: number;
  height: number;
  name: string;
}

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
  additionalTables?: AdditionalTable[];
  primaryTableName?: string;
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
  tableMove = (
    column: number,
    row: number,
    point: Point,
    width: number,
    height: number,
    primaryTableName: string,
    additionalTables?: AdditionalTable[]
  ) => {
    if (this.state || inlineEditorHandler.isOpen()) return false;
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
      additionalTables,
      primaryTableName,
    };
    this.startMove();
  };

  pointerDown = (e: FederatedPointerEvent): boolean => {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || e.button === 1 || inlineEditorHandler.isOpen())
      return false;

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
      events.emit('setDirty', { cellMoving: true });
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
    const position = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
    this.movingCells.toColumn = Math.max(1, position.column + this.movingCells.offset.x);
    this.movingCells.toRow = Math.max(1, position.row + this.movingCells.offset.y);
    events.emit('setDirty', { cellMoving: true });
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
    const cursorRectangle = content.uiCursor.cursorRectangle;
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
      const indicator = content.uiCursor.indicator;
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

    // top/bottom if not columns
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
    if (inlineEditorHandler.isOpen()) {
      this.reset();
      return false;
    }

    // Ignore cursor interactions when the mouse is over the grid headings
    // to allow column/row resizing to work properly
    if (content.headings.intersectsHeadings(world)) {
      this.reset();
      return false;
    }

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

    // Expand to full merged cell when selection is a single cell inside a merge
    if (!colsHover && !rowsHover && rectangle.width === 1 && rectangle.height === 1) {
      const mergeRect = sheets.sheet.getMergeCellRect(rectangle.left, rectangle.top);
      if (mergeRect) {
        rectangle = new Rectangle(
          Number(mergeRect.min.x),
          Number(mergeRect.min.y),
          Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
          Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
        );
      }
    }

    const column = rectangle.left;
    const row = rectangle.top;

    const overlap = this.moveOverlaps(world, !!colsHover, !!rowsHover);
    if (overlap) {
      this.state = 'hover';
      const screenRectangle = content.uiCursor.cursorRectangle;
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

  pointerMove = (world: Point, event?: FederatedPointerEvent): boolean => {
    if (isMobile || pixiAppSettings.panMode !== PanMode.Disabled || event?.button === 1) return false;

    if (this.state === 'move') {
      this.pointerMoveMoving(world);
      return true;
    } else if (event?.buttons === 0) {
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

        // Calculate the delta for all tables to move by
        const deltaX = (this.movingCells.toColumn ?? 0) - (this.movingCells.column ?? 0);
        const deltaY = (this.movingCells.toRow ?? 0) - (this.movingCells.row ?? 0);

        // Check if any cell in the destination rectangle is an invalid drop zone
        // This now includes checking all additional tables as well
        const isInvalidDestination = checkMoveDestinationInvalid(
          this.movingCells.toColumn ?? 0,
          this.movingCells.toRow ?? 0,
          this.movingCells.width ?? 1,
          this.movingCells.height ?? 1,
          this.movingCells.colRows,
          this.movingCells.original,
          this.movingCells.additionalTables
        );

        // Don't allow dropping if destination is invalid
        if (isInvalidDestination) {
          this.reset();
          return true;
        }

        // Use moveColsRows for column/row moves (has special handling), moveCellsBatch for everything else
        if (this.movingCells.colRows) {
          quadraticCore.moveColsRows(
            rectToSheetRect(rectangle, sheets.current),
            this.movingCells.toColumn ?? 0,
            this.movingCells.toRow ?? 0,
            sheets.current,
            this.movingCells.colRows === 'columns',
            this.movingCells.colRows === 'rows',
            false
          );
        } else {
          // Use batch move for table moves (handles single or multiple tables)
          const moves = [
            {
              source: rectToSheetRect(rectangle, sheets.current),
              targetX: Math.max(1, this.movingCells.toColumn ?? 1),
              targetY: Math.max(1, this.movingCells.toRow ?? 1),
              targetSheetId: sheets.current,
            },
            ...(this.movingCells.additionalTables ?? []).map((table) => ({
              source: rectToSheetRect(
                new Rectangle(table.column, table.row, table.width, table.height),
                sheets.current
              ),
              targetX: Math.max(1, table.column + deltaX),
              targetY: Math.max(1, table.row + deltaY),
              targetSheetId: sheets.current,
            })),
          ];
          // Select all moved tables after the move completes
          const tableNames = this.movingCells.primaryTableName
            ? [this.movingCells.primaryTableName, ...(this.movingCells.additionalTables?.map((t) => t.name) ?? [])]
            : undefined;

          const sheetId = sheets.current;
          quadraticCore
            .moveCellsBatch(moves, false)
            .then(() => {
              // Only update selection if we're still on the same sheet
              if (tableNames && sheets.current === sheetId) {
                // Create a selection string from table names (comma-separated)
                const selectionString = tableNames.join(', ');
                const jsSelection = sheets.stringToSelection(selectionString, sheetId);
                sheets.sheet.cursor.loadFromSelection(jsSelection);
              }
            })
            .catch((error) => {
              console.error('Failed to move cells batch:', error);
            });
        }

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
                x: codeCell.pos.x + deltaX,
                y: codeCell.pos.y + deltaY,
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
