import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { calculateAlphaForGridLines } from './gridUtils';
import { colors } from '../../../theme/colors';
import { gridOffsets } from '../../gridDB/gridOffsets';

export const gridLinesGlobals = { show: false };

function drawVerticalLines(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
  const { index, position } = gridOffsets.getColumnIndex(bounds.left);
  let column = index;
  const offset = bounds.left - position;
  let size = 0;
  for (let x = bounds.left; x <= bounds.right; x += size) {
    graphics.moveTo(x - offset, bounds.top);
    graphics.lineTo(x - offset, bounds.bottom);
    size = gridOffsets.getColumnWidth(column);
    column++;
  }
}
function drawHorizontalLines(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
  const { index, position } = gridOffsets.getRowIndex(bounds.top);
  let row = index;
  const offset = bounds.left - position;
  let size = 0;
  for (let y = bounds.left; y <= bounds.right; y += size) {
    graphics.moveTo(bounds.left, y - offset);
    graphics.lineTo(bounds.right, y - offset);
    size = gridOffsets.getRowHeight(row);
    row++;
  }
}

export function gridLines(props: { viewport: Viewport; graphics: PIXI.Graphics }): void {
  const gridAlpha = calculateAlphaForGridLines(props.viewport);
  const { viewport, graphics } = props;
  if (gridAlpha === 0) {
    graphics.visible = false;
    return;
  }
  graphics.alpha = gridAlpha;
  graphics.visible = true;
  graphics.clear();

  if (!gridLinesGlobals.show) return;

  graphics.lineStyle(1, colors.gridLines, 0.25, 0.5, true);
  const bounds = viewport.getVisibleBounds();
  drawVerticalLines(graphics, bounds);
  drawHorizontalLines(graphics, bounds);
}
