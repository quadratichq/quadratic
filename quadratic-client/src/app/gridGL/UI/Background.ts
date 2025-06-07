import { sheets } from '@/app/grid/controller/Sheets';
import { colors } from '@/app/theme/colors';
import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';

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
    this.rect(left, top, right - left, bottom - top);
    this.fill({ color: colors.gridBackground });

    // draw out of bounds to the left
    if (left > bounds.left) {
      this.rect(bounds.left, top, left - bounds.left, bottom - top);
      this.fill({ color: colors.gridBackgroundOutOfBounds });
    }

    // draw out of bounds to the top
    if (top > bounds.top) {
      this.rect(bounds.left, bounds.top, right - bounds.left, top - bounds.top);
      this.fill({ color: colors.gridBackgroundOutOfBounds });
    }
  };
}
