//! Handles pointer events for data tables.

import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isMac } from '@/shared/utils/isMac';
import type { Point } from 'pixi.js';

// todo: dragging on double click

export class PointerTable {
  cursor: string | undefined;

  private doubleClickTimeout: number | undefined;
  private tableNameDown: { column: number; row: number; point: Point } | undefined;

  private pointerDownTableName(world: Point, tableDown: TablePointerDownResult, append: boolean) {
    sheets.sheet.cursor.selectTable(tableDown.table.name, undefined, append);
    pixiApp.cellsSheet().tables.ensureActive(tableDown.table);
    if (this.doubleClickTimeout) {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        rename: true,
      });
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    } else {
      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
      this.tableNameDown = { column: tableDown.table.x, row: tableDown.table.y, point: world };
    }
  }

  private pointerDownDropdown(world: Point, tableDown: TablePointerDownResult) {
    events.emit('contextMenu', {
      type: ContextMenuType.Table,
      world,
      column: tableDown.table.x,
      row: tableDown.table.y,
      table: tableDown.table,
    });
  }

  private pointerDownColumnName(world: Point, tableDown: TablePointerDownResult, append: boolean) {
    if (tableDown.column === undefined) {
      throw new Error('Expected column to be defined in pointerTable');
    }
    if (this.doubleClickTimeout) {
      events.emit('contextMenu', {
        type: ContextMenuType.TableColumn,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        rename: true,
        selectedColumn: tableDown.column,
      });
    } else {
      // move cursor to column header
      const columnName = tableDown.table.columns[tableDown.column].name;
      sheets.sheet.cursor.selectTable(tableDown.table.name, columnName, append);

      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
    }
  }

  pointerDown(world: Point, event: PointerEvent): boolean {
    let tableDown = pixiApp.cellsSheet().tables.pointerDown(world);
    if (!tableDown?.table) {
      const image = pixiApp.cellsSheet().cellsImages.contains(world);
      if (image) {
        if (this.doubleClickTimeout) {
          clearTimeout(this.doubleClickTimeout);
          this.doubleClickTimeout = undefined;
          doubleClickCell({ column: image.x, row: image.y, language: 'Javascript' });
        } else {
          pixiApp.cellsSheet().tables.ensureActiveCoordinate(image);
          sheets.sheet.cursor.moveTo(image.x, image.y);
          this.doubleClickTimeout = window.setTimeout(() => {
            this.doubleClickTimeout = undefined;
          }, DOUBLE_CLICK_TIME);
        }
        return true;
      }
      return false;
    }
    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      events.emit('contextMenu', {
        type: tableDown.type === 'column-name' ? ContextMenuType.TableColumn : ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        selectedColumn: tableDown.column,
      });
      return true;
    }

    if (tableDown.type === 'table-name') {
      this.pointerDownTableName(world, tableDown, event.shiftKey);
    } else if (tableDown.type === 'dropdown') {
      this.pointerDownDropdown(world, tableDown);
    } else if (tableDown.type === 'sort') {
      // tables doesn't have to do anything with sort; it's handled in TableColumnHeader
    } else if (tableDown.type === 'column-name') {
      this.pointerDownColumnName(world, tableDown, event.shiftKey);
    }
    return true;
  }

  pointerMove(world: Point): boolean {
    if (this.doubleClickTimeout) {
      clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
    if (this.tableNameDown) {
      if (
        this.tableNameDown.column !== this.tableNameDown.point.x ||
        this.tableNameDown.row !== this.tableNameDown.point.y
      ) {
        pixiApp.pointer.pointerCellMoving.tableMove(
          this.tableNameDown.column,
          this.tableNameDown.row,
          this.tableNameDown.point
        );
      }
      this.tableNameDown = undefined;
      return true;
    }
    const result = pixiApp.cellsSheet().tables.pointerMove(world);
    this.cursor = pixiApp.cellsSheet().tables.tableCursor;
    return result;
  }

  pointerUp(): boolean {
    if (this.tableNameDown) {
      this.tableNameDown = undefined;
      return true;
    }
    return false;
  }
}
