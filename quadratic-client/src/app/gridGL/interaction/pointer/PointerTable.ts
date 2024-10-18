//! Handles pointer events for data tables.

import { ContextMenuSpecial, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isMac } from '@/shared/utils/isMac';
import { Point } from 'pixi.js';

// todo: dragging on double click

export class PointerTable {
  private doubleClickTimeout: number | undefined;

  pointerDown(world: Point, event: PointerEvent): boolean {
    const result = pixiApp.cellsSheets.current?.tables.pointerDown(world);
    if (!result) {
      return false;
    }
    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        world,
        column: result.table.x,
        row: result.table.y,
        table: result.table,
      });
    }

    if (result.nameOrDropdown === 'name') {
      if (this.doubleClickTimeout) {
        events.emit('contextMenu', {
          type: ContextMenuType.Table,
          world,
          column: result.table.x,
          row: result.table.y,
          table: result.table,
          special: ContextMenuSpecial.rename,
        });
      } else {
        this.doubleClickTimeout = window.setTimeout(() => {
          this.doubleClickTimeout = undefined;
        }, DOUBLE_CLICK_TIME);
      }
    } else if (result.nameOrDropdown === 'dropdown') {
      events.emit('contextMenu', {
        type: ContextMenuType.Table,
        column: result.table.x,
        row: result.table.y,
        world,
        table: result.table,
      });
    }
    return true;
  }

  pointerMove(): boolean {
    if (this.doubleClickTimeout) {
      clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
    return false;
  }
}
