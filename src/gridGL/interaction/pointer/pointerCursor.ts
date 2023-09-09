import { pixiApp } from '../../pixiApp/PixiApp';

export class PointerCursor {
  pointerMove(): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
  }
}
