import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

interface IProps {
  viewport: Viewport;
  graphics: PIXI.Graphics;
}

export const axesLinesGlobals = { showGridAxes: true };

export function axesLines(props: IProps): void {
  const { viewport, graphics } = props;
  graphics.clear();
  if (axesLinesGlobals.showGridAxes) {
    graphics.lineStyle(10, 0x000000, 0.35, 0, true);
    if (0 >= viewport.left && 0 <= viewport.right) {
      graphics.moveTo(0, viewport.top);
      graphics.lineTo(0, viewport.bottom);
    }
    if (0 >= viewport.top && 0 <= viewport.bottom) {
      graphics.moveTo(viewport.left, 0);
      graphics.lineTo(viewport.right, 0);
    }
  }
}
