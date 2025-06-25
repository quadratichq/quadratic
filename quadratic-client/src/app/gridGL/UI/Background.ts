import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { colors } from '@/app/theme/colors';
import { Graphics } from 'pixi.js';

export class Background extends Graphics {
  update = (dirty: boolean) => {
    if (!dirty) {
      return;
    }

    this.clear();
    const clamp = sheets.sheet.clamp;
    const bounds = pixiApp.viewport.getVisibleBounds();
    const left = Math.max(bounds.left, clamp.left);
    const top = Math.max(bounds.top, clamp.top);
    const right = Math.min(bounds.right, clamp.right);
    const bottom = Math.min(bounds.bottom, clamp.bottom);

    // draw normal background
    this.beginFill(colors.gridBackground);
    this.drawRect(left, top, right - left, bottom - top);
    this.endFill();

    // draw out of bounds to the left
    if (left > bounds.left) {
      this.beginFill(colors.gridBackgroundOutOfBounds);
      this.drawRect(bounds.left, top, left - bounds.left, bottom - top);
      this.endFill();
    }

    // draw out of bounds to the top
    if (top > bounds.top) {
      this.beginFill(colors.gridBackgroundOutOfBounds);
      this.drawRect(bounds.left, bounds.top, right - bounds.left, top - bounds.top);
      this.endFill();
    }
  };
}
