import { ContextMenuType } from '@/app/atoms/contextMenuAtoms';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isMac } from '@/shared/utils/isMac';
import { Point } from 'pixi.js';

export class PointerDownTable {
  pointerDown(world: Point, event: PointerEvent): boolean {
    const result = pixiApp.cellsSheets.current?.tables.pointerDown(world);
    if (!result) {
      return false;
    }
    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      events.emit('contextMenu', ContextMenuType.Table, world, null, null);
    }

    if (result.nameOrDropdown === 'name') {
      // todo: dragging and/or renaming on double click
    } else if (result.nameOrDropdown === 'dropdown') {
      events.emit('contextMenu', ContextMenuType.Table, world, null, null);
    }
    return true;
  }
}
