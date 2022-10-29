import { Graphics } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';

export class AxesLines extends Graphics {
  private app: PixiApp;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      if (!this.app.settings.showGridAxes) {
        this.visible = false;
        return;
      }

      this.visible = true;
      this.clear();
      this.lineStyle(10, 0x000000, 0.35, 0, true);
      const viewport = this.app.viewport;
      if (0 >= viewport.left && 0 <= viewport.right) {
        this.moveTo(0, viewport.top);
        this.lineTo(0, viewport.bottom);
      }
      if (0 >= viewport.top && 0 <= viewport.bottom) {
        this.moveTo(viewport.left, 0);
        this.lineTo(viewport.right, 0);
      }
    }
  }
}