import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { Point } from 'pixi.js';

export class PointerCursor {
  private lastInfo?: JsRenderCodeCell | EditingCell | ErrorValidation;

  constructor() {
    events.on('cursorPosition', this.checkLastHoverCell);
  }

  destroy() {
    events.off('cursorPosition', this.checkLastHoverCell);
  }

  // ensure we check the hover cell whenever the cursor moves (this removes the
  // double hover cell when the cursor is already in a cell that has a
  // validation message)
  private checkLastHoverCell = () => {
    this.checkHoverCell(pixiApp.viewport.getWorld());
  };

  private checkHoverCell(world: Point) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const cell = sheets.sheet.getColumnRow(world.x, world.y);
    const editingCell = multiplayer.cellIsBeingEdited(cell.x, cell.y, sheets.current);
    if (editingCell) {
      const detail = { x: cell.x, y: cell.y, user: editingCell.user, codeEditor: editingCell.codeEditor };
      events.emit('hoverCell', detail);
      this.lastInfo = detail;
      return;
    }

    let foundCodeCell = false;
    const codeCell = pixiApp.cellsSheets.current.tables.hoverCodeCell(world);
    if (codeCell && (codeCell.spill_error || codeCell.language !== 'Import')) {
      if (this.lastInfo?.x !== codeCell.x || this.lastInfo?.y !== codeCell.y) {
        events.emit('hoverCell', codeCell);
        this.lastInfo = codeCell;
      }
      foundCodeCell = true;
    }

    let foundValidation = false;
    const validation = pixiApp.cellsSheets.current.cellsLabels.intersectsErrorMarkerValidation(world);
    // don't allow hover cell when it's already open b/c the cursor is in the cell
    const cursor = sheets.sheet.cursor.position;
    if (validation && (cell.x !== cursor.x || cell.y !== cursor.y)) {
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
  }

  pointerMove(world: Point): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.sendMouseMove(world.x, world.y);
    this.checkHoverCell(world);
  }
}
