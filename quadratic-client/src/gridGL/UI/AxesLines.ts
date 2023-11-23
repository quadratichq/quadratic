import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';

export class AxesLines extends Graphics {
  dirty = true;

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();

      if (!pixiAppSettings.showGridAxes) {
        this.visible = false;
        pixiApp.setViewportDirty();
        return;
      }

      this.visible = true;
      this.lineStyle(10, colors.gridLines, 0.5, 0, true);
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
