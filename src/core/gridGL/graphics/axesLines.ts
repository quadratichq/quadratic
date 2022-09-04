import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

interface IProps {
  viewport: Viewport;
  graphics: PIXI.Graphics;
}

export const axesLinesProps = { showGridAxes: true };

export function axesLines(props: IProps): void {
  if (axesLinesProps.showGridAxes) {
    props.graphics.lineStyle(10, 0x000000, 0.35, 0, true);
    if (0 >= props.viewport.left && 0 <= props.viewport.right) {
      props.graphics.moveTo(0, props.viewport.top);
      props.graphics.lineTo(0, props.viewport.bottom);
    }
    if (0 >= props.viewport.top && 0 <= props.viewport.bottom) {
      props.graphics.moveTo(props.viewport.left, 0);
      props.graphics.lineTo(props.viewport.right, 0);
    }
  }
}