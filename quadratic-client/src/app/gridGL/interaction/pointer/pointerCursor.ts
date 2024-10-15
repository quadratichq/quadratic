import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { Point } from 'pixi.js';
import { intersects } from '../../helpers/intersects';

export class PointerCursor {
  private lastInfo?: JsRenderCodeCell | EditingCell | ErrorValidation;
  private lastTable?: JsRenderCodeCell;

  private checkHoverCell(world: Point, event: PointerEvent) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const cell = sheets.sheet.getColumnRow(world.x, world.y);
    const editingCell = multiplayer.cellIsBeingEdited(cell.x, cell.y, sheets.sheet.id);
    if (editingCell) {
      const detail = { x: cell.x, y: cell.y, user: editingCell.user, codeEditor: editingCell.codeEditor };
      events.emit('hoverCell', detail);
      this.lastInfo = detail;
      return;
    }

    let foundCodeCell = false;
    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
    if (codeCell) {
      if (this.lastInfo?.x !== codeCell.x || this.lastInfo?.y !== codeCell.y) {
        events.emit('hoverCell', codeCell);
        this.lastInfo = codeCell;
      }
      foundCodeCell = true;
    }

    let foundTable = false;
    const table = pixiApp.cellsSheets.current.cellsArray.getCodeCellWorld(world);
    if (table) {
      if (this.lastTable?.x !== table.x || this.lastTable?.y !== table.y) {
        events.emit('hoverTable', table);
        this.lastTable = table;
      }
      foundTable = true;
    } else if (this.lastTable) {
      const tablesHeading = document.querySelector('.tables-overlay');
      if (tablesHeading) {
        const rect = tablesHeading.getBoundingClientRect();
        if (intersects.rectanglePoint(rect, { x: event.clientX, y: event.clientY })) {
          foundTable = true;
        }
      }
    }

    let foundValidation = false;
    const validation = pixiApp.cellsSheets.current.cellsLabels.intersectsErrorMarkerValidation(world);
    if (validation) {
      if (this.lastInfo?.x !== validation.x || this.lastInfo?.y !== validation.y) {
        events.emit('hoverCell', validation);
        this.lastInfo = validation;
      }
      foundValidation = true;
    }

    if (!foundCodeCell && !foundValidation && this.lastInfo) {
      events.emit('hoverCell');
      this.lastInfo = undefined;
    }

    if (!foundTable && this.lastTable) {
      events.emit('hoverTable');
      this.lastTable = undefined;
    }
  }

  pointerMove(world: Point, event: PointerEvent): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.sendMouseMove(world.x, world.y);
    this.checkHoverCell(world, event);
  }
}
