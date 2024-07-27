import type { Point } from 'pixi.js';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';

export class PointerCursor {
  private lastCodeInfo?: JsRenderCodeCell | EditingCell;

  private checkHoverCell(world: Point) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const cell = sheets.sheet.getColumnRow(world.x, world.y);
    const editingCell = multiplayer.cellIsBeingEdited(cell.x, cell.y, sheets.sheet.id);
    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
    if (editingCell) {
      const detail = { x: cell.x, y: cell.y, user: editingCell.user, codeEditor: editingCell.codeEditor };
      events.emit('hoverCell', detail);
      this.lastCodeInfo = detail;
    } else if (codeCell) {
      if (this.lastCodeInfo?.x !== codeCell.x || this.lastCodeInfo?.y !== codeCell.y) {
        events.emit('hoverCell', codeCell);
        this.lastCodeInfo = codeCell;
      }
    } else {
      if (this.lastCodeInfo) {
        events.emit('hoverCell');
        this.lastCodeInfo = undefined;
      }
    }
  }

  pointerMove(world: Point): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.sendMouseMove(world.x, world.y);
    this.checkHoverCell(world);
  }
}
