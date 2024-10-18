import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isMac } from '@/shared/utils/isMac';
import { Point } from 'pixi.js';

export class PointerTable {
  pointerDown(world: Point, event: PointerEvent): boolean {
    const result = pixiApp.cellsSheets.current?.tables.pointerDown(world);
    if (!result) {
      return false;
    }
    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      events.emit('contextMenu', { type: ContextMenuType.Table, world, table: result.table });
    }

    if (result.nameOrDropdown === 'name') {
      // todo: dragging and/or renaming on double click
    } else if (result.nameOrDropdown === 'dropdown') {
      events.emit('contextMenu', { type: ContextMenuType.Table, world, table: result.table });
    }
    return true;
  }
}
