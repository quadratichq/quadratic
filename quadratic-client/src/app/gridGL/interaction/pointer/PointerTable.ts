//! Handles pointer events for data tables.

import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isMac } from '@/shared/utils/isMac';
import { Point } from 'pixi.js';

// todo: dragging on double click

export class PointerTable {
  cursor: string | undefined;

  private doubleClickTimeout: number | undefined;

  private pointerDownTableName(world: Point, tableDown: TablePointerDownResult) {
    if (this.doubleClickTimeout) {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        rename: true,
      });
    } else {
      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
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

  private pointerDownColumnName(world: Point, tableDown: TablePointerDownResult) {
    if (tableDown.column === undefined) {
      throw new Error('Expected column to be defined in pointerTable');
    }
    if (this.doubleClickTimeout) {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        rename: true,
        selectedColumn: tableDown.column,
      });
    } else {
      // move cursor to column header
      sheets.sheet.cursor.changePosition({
        cursorPosition: { x: tableDown.table.x + tableDown.column, y: tableDown.table.y },
      });

      // select entire column?

      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
    }
  }

  pointerDown(world: Point, event: PointerEvent): boolean {
    const tableDown = pixiApp.cellSheet().tables.pointerDown(world);
    if (!tableDown?.table) return false;

    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
      });
    }

    if (tableDown.type === 'table-name') {
      this.pointerDownTableName(world, tableDown);
    } else if (tableDown.type === 'dropdown') {
      this.pointerDownDropdown(world, tableDown);
    } else if (tableDown.type === 'sort') {
      // tables doesn't have to do anything with sort; it's handled in TableColumnHeader
    } else if (tableDown.type === 'column-name') {
      this.pointerDownColumnName(world, tableDown);
    }
    return true;
  }

  pointerMove(world: Point): boolean {
    if (this.doubleClickTimeout) {
      clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
    const result = pixiApp.cellSheet().tables.pointerMove(world);
    this.cursor = pixiApp.cellSheet().tables.tableCursor;
    return result;
  }
}
