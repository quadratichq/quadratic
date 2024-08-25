//! This shows the background for the grid. There are two portions of the
//! background: in-bounds and out-of-bounds.

import { Graphics } from 'pixi.js';
import { pixiApp } from './PixiApp';
import { colors } from '@/app/theme/colors';
import { outOfBoundsBottom, outOfBoundsRight } from '../UI/gridHeadings/outOfBounds';

export class Background extends Graphics {
  update(viewportDirty: boolean) {
    if (!viewportDirty) return;
    this.clear();
    const visibleBounds = pixiApp.viewport.getVisibleBounds();

    const oobRight = outOfBoundsRight(visibleBounds.right);
    const oobBottom = outOfBoundsBottom(visibleBounds.bottom);

    // draw out of bounds area (left)
    if (visibleBounds.left < 0) {
      const right = Math.min(0, visibleBounds.right);
      const bottom = Math.max(0, visibleBounds.bottom);
      this.beginFill(colors.outOfBoundsBackgroundColor);
      this.drawRect(visibleBounds.left, 0, right - visibleBounds.left, bottom);
      this.endFill();
    }

    // draw out of bounds area (top)
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
    const width = Math.min(oobRight ?? visibleBounds.right, visibleBounds.right) - x;
    const height = Math.min(oobBottom ?? visibleBounds.bottom, visibleBounds.bottom) - y;
    this.drawRect(x, y, width, height);
    this.endFill();

    // draw out of bounds (right)
    if (oobRight !== undefined) {
      this.beginFill(colors.outOfBoundsBackgroundColor);
      this.drawRect(oobRight, 0, visibleBounds.right - oobRight, visibleBounds.bottom);
      this.endFill();
    }

    // draw out of bounds (bottom)
    if (oobBottom !== undefined) {
      this.beginFill(colors.outOfBoundsBackgroundColor);
      this.drawRect(visibleBounds.left, oobBottom, visibleBounds.width, visibleBounds.bottom - oobBottom);
      this.endFill();
    }
  }
}
