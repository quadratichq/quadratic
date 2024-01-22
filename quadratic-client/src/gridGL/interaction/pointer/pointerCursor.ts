import { Coordinate } from '@/gridGL/types/size';
import { multiplayer } from '@/multiplayer/multiplayer';
import { Point } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';

export class PointerCursor {
  private lastCodeError?: Coordinate;

  private checkCodeErrors(world: Point) {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeError(world);
    if (codeCell) {
      if (this.lastCodeError?.x !== codeCell.x || this.lastCodeError?.y !== codeCell.y) {
        window.dispatchEvent(
          new CustomEvent('overlap-code-error', {
            detail: { location: { x: codeCell.x, y: codeCell.y }, type: codeCell.type },
          })
        );
        this.lastCodeError = codeCell;
      }
    } else {
      if (this.lastCodeError) {
        window.dispatchEvent(new CustomEvent('overlap-code-error'));
        this.lastCodeError = undefined;
      }
    }
  }

  pointerMove(world: Point): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.sendMouseMove(world.x, world.y);
    this.checkCodeErrors(world);
  }
}
