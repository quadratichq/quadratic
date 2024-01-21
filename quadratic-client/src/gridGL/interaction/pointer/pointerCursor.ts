import { sheets } from '@/grid/controller/Sheets';
import { EditingCell } from '@/gridGL/HTMLGrid/hoverCell/HoverCell';
import { multiplayer } from '@/multiplayer/multiplayer';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { Point } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';

export class PointerCursor {
  private lastCodeInfo?: JsRenderCodeCell | EditingCell;

  private checkHoverCell(world: Point) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const cell = sheets.sheet.getColumnRow(world.x, world.y);
    const editingCell = multiplayer.cellIsBeingEdited(cell.x, cell.y, sheets.sheet.id);
    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
    if (editingCell) {
      const detail = { x: cell.x, y: cell.y, user: editingCell.user, codeEditor: editingCell.codeEditor };
      window.dispatchEvent(
        new CustomEvent('hover-cell', {
          detail,
        })
      );
      this.lastCodeInfo = detail;
    } else if (codeCell) {
      if (this.lastCodeInfo?.x !== codeCell.x || this.lastCodeInfo?.y !== codeCell.y) {
        window.dispatchEvent(
          new CustomEvent('hover-cell', {
            detail: codeCell,
          })
        );
        this.lastCodeInfo = codeCell;
      }
    } else {
      if (this.lastCodeInfo) {
        window.dispatchEvent(new CustomEvent('hover-cell'));
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
