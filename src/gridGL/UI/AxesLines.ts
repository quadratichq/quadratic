import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';

export class AxesLines extends Graphics {
  dirty = true;

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();

      if (!pixiApp.settings.showGridAxes) {
        this.visible = false;
        pixiApp.setViewportDirty();
        return;
      }

      this.visible = true;
      this.lineStyle(10, 0x000000, 0.35, 0, true);
      const viewport = pixiApp.viewport;
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
