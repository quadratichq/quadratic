import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { Point } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';
import { ErrorValidation } from '../../cells/CellsSheet';

export class PointerCursor {
  private lastInfo?: JsRenderCodeCell | EditingCell | ErrorValidation;

  private checkHoverCell(world: Point) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const cell = sheets.sheet.getColumnRow(world.x, world.y);
    const editingCell = multiplayer.cellIsBeingEdited(cell.x, cell.y, sheets.sheet.id);
    if (editingCell) {
      const detail = { x: cell.x, y: cell.y, user: editingCell.user, codeEditor: editingCell.codeEditor };
      events.emit('hoverCell', detail);
      this.lastInfo = detail;
      return;
    }

    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
    if (codeCell) {
      if (this.lastInfo?.x !== codeCell.x || this.lastInfo?.y !== codeCell.y) {
        events.emit('hoverCell', codeCell);
        this.lastInfo = codeCell;
      }
      return;
    }

    const validation = pixiApp.cellsSheets.current.cellsLabels.intersectsErrorMarkerValidation(world);
    if (validation) {
      if (this.lastInfo?.x !== validation.x || this.lastInfo?.y !== validation.y) {
        events.emit('hoverCell', validation);
        this.lastInfo = validation;
      }
      return;
    }

    if (this.lastInfo) {
      events.emit('hoverCell');
      this.lastInfo = undefined;
    }
  }

  pointerMove(world: Point): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.sendMouseMove(world.x, world.y);
    this.checkHoverCell(world);
  }
}
