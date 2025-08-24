import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { ColumnRow, JsCoordinate } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';

export type StateVertical = 'expandDown' | 'expandUp' | 'shrink' | undefined;
export type StateHorizontal = 'expandRight' | 'expandLeft' | 'shrink' | undefined;
export type DragDirection = 'right' | 'bottom' | 'corner' | undefined;

export class PointerTableResize {
  cursor?: string;

  private selection?: Rectangle;
  private selectionRight?: Rectangle;
  private selectionBottom?: Rectangle;
  private tableBounds?: ColumnRow;

  private endCell?: JsCoordinate;

  private stateHorizontal: StateHorizontal;
  private stateVertical: StateVertical;

  private active = false;

  private dragDirection?: DragDirection;

  pointerDown = (world: Point): boolean => {
    if (isMobile) return false;
    if (pixiAppSettings.panMode !== PanMode.Disabled) return false;

    return this.applyState(world, true);
  };

  private reset = (): void => {
    if (this.active) {
      events.emit('cellMoving', false);
      this.stateHorizontal = undefined;
      this.stateVertical = undefined;
      this.endCell = undefined;
      this.selection = undefined;
      this.selectionRight = undefined;
      this.selectionBottom = undefined;
      this.dragDirection = undefined;
      this.active = false;
      content.boxCells.reset();
      sheets.sheet.cursor.changeBoxCells(false);
      this.setCursorDirection(undefined);
      this.tableBounds = undefined;
    }
  };

  private setCursorDirection = (dragDirection: DragDirection): void => {
    switch (dragDirection) {
      case 'bottom':
        this.cursor = 'row-resize';
        break;
      case 'right':
        this.cursor = 'col-resize';
        break;
      case 'corner':
        this.cursor = 'nwse-resize';
        break;
      default:
        this.cursor = undefined;
        break;
    }
  };

  private applyState = (world: Point, isPointerDown: boolean = false): boolean => {
    if (!this.selection || !this.selectionRight || !this.selectionBottom || !this.tableBounds) return false;

    const setValues = (direction: DragDirection) => {
      if (isPointerDown) {
        this.active = true;
        this.dragDirection = direction;
        events.emit('cellMoving', true);
        sheets.sheet.cursor.changeBoxCells(true);
      }

      this.setCursorDirection(direction);

      return true;
    };

    // handle dragging from the corner
    if (intersects.rectanglePoint(this.selection, world)) {
      return setValues('corner');
    }

    // drag from the right handle
    if (intersects.rectanglePoint(this.selectionRight, world)) {
      return setValues('right');
    }

    // drag from the bottom handle
    if (intersects.rectanglePoint(this.selectionBottom, world)) {
      return setValues('bottom');
    }

    this.setCursorDirection(this.dragDirection);

    if (isPointerDown) this.dragDirection = undefined;

    return false;
  };

  pointerMove = (world: Point): boolean => {
    if (isMobile) return false;
    if (pixiAppSettings.panMode !== PanMode.Disabled) return false;

    if (!this.active) {
      const table = pixiApp.cellsSheet().tables.getTableIntersectsWorld(new Point(world.x - 4, world.y - 4));
      if (!!table && table.checkHover(world) && !table.codeCell.is_code) {
        const cornerHandle = new Rectangle(
          table.tableBounds.x + table.tableBounds.width - 4,
          table.tableBounds.y + table.tableBounds.height - 4,
          8,
          8
        );
        const rightHandle = new Rectangle(
          table.tableBounds.x + table.tableBounds.width - 4,
          table.tableBounds.y,
          8,
          table.tableBounds.height - 8
        );
        const bottomHandle = new Rectangle(
          table.tableBounds.x,
          table.tableBounds.y + table.tableBounds.height - 4,
          table.tableBounds.width - 8,
          8
        );

        this.selection = cornerHandle;
        this.selectionRight = rightHandle;
        this.selectionBottom = bottomHandle;
        this.tableBounds = table.sheet.getColumnRowFromScreen(table.tableBounds.x, table.tableBounds.y);
      } else {
        this.cursor = undefined;
        this.selection = undefined;
        this.selectionRight = undefined;
        this.selectionBottom = undefined;
        this.tableBounds = undefined;
      }
    }

    this.applyState(world);

    if (!this.active && this.selection) return false;

    if (this.active && this.tableBounds && this.selection && this.selectionRight && this.selectionBottom) {
      const { column, row } = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
      const { column: columnSelection, row: rowSelection } = sheets.sheet.getColumnRowFromScreen(
        this.selection.x,
        this.selection.y
      );
      const selection = new Rectangle(
        this.tableBounds.column,
        this.tableBounds.row,
        columnSelection - this.tableBounds.column,
        rowSelection - this.tableBounds.row
      );

      const toDeleteRectangle = () => {
        let rectangles: Rectangle[] = [];

        // right of the selection
        if (this.dragDirection !== 'bottom') {
          let rightTop = selection.top + 1;
          let rightLeft = Math.max(column + 1, selection.left + 1);
          let rightWidth = Math.max(selection.right - rightLeft + 1, 0);
          let rightHeight = selection.bottom - rightTop + 1;
          rectangles.push(new Rectangle(rightLeft, rightTop, rightWidth, rightHeight));
        }

        // bottom of the selection
        if (this.dragDirection !== 'right') {
          let bottomX = selection.left;
          let bottomY = Math.max(Math.min(row + 1, selection.bottom), selection.top + 2);
          let bottomWidth = Math.max(1, Math.min(column - selection.left + 1, selection.width + 1));
          let bottomHeight = Math.max(0, Math.min(selection.bottom - row, selection.height - 1));

          if (this.dragDirection === 'bottom') {
            bottomWidth = selection.width + 1;
          }

          rectangles.push(new Rectangle(bottomX, bottomY, bottomWidth, bottomHeight));
        }

        return rectangles;
      };

      this.endCell = { x: column, y: row };
      let deleteRectangles: Rectangle[] = [];

      const boxCellsRectangle = selection.clone();
      boxCellsRectangle.height += 1;
      boxCellsRectangle.width += 1;

      // Handle changes in rows

      // if at top or between top and bottom then we shrink
      if (row >= selection.top && row <= selection.bottom) {
        this.stateVertical = 'shrink';

        if (this.dragDirection !== 'right') {
          boxCellsRectangle.height = row - selection.top + 1;
        }

        if (this.dragDirection === 'bottom') {
          boxCellsRectangle.width = selection.width + 1;
        }

        deleteRectangles = toDeleteRectangle();
      }

      // if above top, then do nothing
      else if (row < selection.top) {
        this.stateVertical = undefined;
        boxCellsRectangle.height = 2;
        deleteRectangles = toDeleteRectangle();
      }

      // if below bottom, then we expand down
      else if (row > selection.bottom && this.dragDirection !== 'right') {
        this.stateVertical = 'expandDown';
        boxCellsRectangle.height = row - selection.y + 1;

        if (this.dragDirection === 'bottom') {
          boxCellsRectangle.width = selection.width + 1;
        }
      }

      // Handle changes in column

      // if at left or between left and right then we shrink
      if (column >= selection.left && column < selection.right && this.dragDirection !== 'bottom') {
        this.stateHorizontal = 'shrink';
        boxCellsRectangle.width = column - selection.left + 1;
        deleteRectangles = toDeleteRectangle();
      }

      // if to the left of the selection then we do nothing
      else if (column < selection.left && this.dragDirection !== 'bottom') {
        this.stateHorizontal = undefined;
        boxCellsRectangle.width = 1;
        deleteRectangles = toDeleteRectangle();
      }

      // if to the right of the selection then we expand right
      else if (column >= selection.right && this.dragDirection !== 'bottom') {
        this.stateHorizontal = 'expandRight';
        boxCellsRectangle.width = column + 1 - selection.x;

        if (this.dragDirection === 'right') {
          boxCellsRectangle.height = selection.height + 1;
        }
      }

      this.endCell = {
        x: boxCellsRectangle.x + boxCellsRectangle.width,
        y: boxCellsRectangle.y + boxCellsRectangle.height,
      };

      content.boxCells.populate({
        gridRectangle: boxCellsRectangle,
        horizontalDelete: this.stateHorizontal === 'shrink',
        verticalDelete: this.stateVertical === 'shrink',
        deleteRectangles,
      });

      multiplayer.sendMouseMove(world.x, world.y);

      return true;
    }

    return false;
  };

  pointerUp = (): boolean => {
    if (!this.active) {
      return false;
    }

    if (!this.selection || !this.selectionRight || !this.selectionBottom || !this.tableBounds) {
      return true;
    }

    const sheet = sheets.sheet;

    if (this.endCell) {
      const { column: columnSelection, row: rowSelection } = sheets.sheet.getColumnRowFromScreen(
        this.selection.x,
        this.selection.y
      );

      const width = columnSelection - this.tableBounds.column + 1;
      const height = rowSelection - this.tableBounds.row + 1;
      const newWidth = this.endCell.x - this.tableBounds.column;
      const newHeight = this.endCell.y - this.tableBounds.row;

      const newRectangle = new Rectangle(this.tableBounds.column, this.tableBounds.row, newWidth, newHeight);

      if (
        newRectangle.x !== this.tableBounds.column ||
        newRectangle.y !== this.tableBounds.row ||
        newRectangle.width !== width ||
        newRectangle.height !== height
      ) {
        const columnsToAdd = Math.max(0, newWidth - width);
        const columnsToRemove = Math.max(0, width - newWidth);
        const rowsToAdd = Math.max(0, newHeight - height);
        const rowsToRemove = Math.max(0, height - newHeight);
        const toArray = (size: number, base: number, fn: (i: number, base: number) => number) =>
          Array(size)
            .fill(0)
            .map((_, i) => fn(i, base));

        // update the table
        quadraticCore.dataTableMutations({
          sheetId: sheet.id,
          x: this.tableBounds.column,
          y: this.tableBounds.row,
          select_table: true,
          columns_to_add: toArray(columnsToAdd, width, (i, base) => base + i),
          columns_to_remove: toArray(columnsToRemove, width, (i, base) => base - i - 1),
          rows_to_add: toArray(rowsToAdd, height, (i, base) => base + i),
          rows_to_remove: toArray(rowsToRemove, height, (i, base) => base - i - 1),
          flatten_on_delete: true,
          swallow_on_insert: true,
        });
      }
    }

    this.reset();

    return true;
  };

  handleEscape = (): boolean => {
    if (this.active) {
      this.reset();
      return true;
    }
    return false;
  };
}
