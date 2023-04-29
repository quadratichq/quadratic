import { PixiApp } from '../../pixiApp/PixiApp';

export class PointerCursor {
  private app: PixiApp;

  constructor(app: PixiApp) {
    this.app = app;
  }

  pointerMove(): void {
    const cursor = this.app.pointer.pointerHeading.cursor ?? this.app.pointer.pointerAutoComplete.cursor;
    this.app.canvas.style.cursor = cursor ?? 'unset';
  }
}
