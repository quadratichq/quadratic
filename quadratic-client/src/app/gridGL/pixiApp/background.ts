//! This shows the background for the grid. There are two portions of the
//! background: in-bounds and out-of-bounds.

import { Graphics } from 'pixi.js';
import { pixiApp } from './PixiApp';
import { colors } from '@/app/theme/colors';

export class Background extends Graphics {
  update(viewportDirty: boolean) {
    if (!viewportDirty) return;
    this.clear();
    const visibleBounds = pixiApp.viewport.getVisibleBounds();
    if (visibleBounds.left < 0) {
      const right = Math.min(0, visibleBounds.right);
      const bottom = Math.max(0, visibleBounds.bottom);
      this.beginFill(colors.outOfBoundsBackgroundColor);
      this.drawRect(visibleBounds.left, 0, right - visibleBounds.left, bottom);
      this.endFill();
    }
    if (visibleBounds.top < 0) {
      const right = Math.max(0, visibleBounds.right);
      const bottom = Math.min(0, visibleBounds.bottom);
      this.beginFill(colors.outOfBoundsBackgroundColor);
      this.drawRect(visibleBounds.left, visibleBounds.top, right - visibleBounds.left, bottom - visibleBounds.top);
      this.endFill();
    }

    // draw normal area
    this.beginFill(colors.gridBackground);
    const x = Math.max(0, visibleBounds.left);
    const y = Math.max(0, visibleBounds.top);
    this.drawRect(x, y, visibleBounds.right - x, visibleBounds.bottom - y);
    this.endFill();
  }
}
