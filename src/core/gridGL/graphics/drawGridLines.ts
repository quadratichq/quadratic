import { Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
} from '../../../constants/gridConstants';

import { colors } from '../../../theme/colors';

const drawGridLines = function (viewport: Viewport, grid: Graphics, showGridAxes: boolean): void {
  grid.clear();

  // Configure Line Style
  grid.lineStyle(1, colors.gridLines, 0.25, 0.5, true);

  const bounds = viewport.getVisibleBounds();
  const x_offset = bounds.left % CELL_WIDTH;
  const y_offset = bounds.top % CELL_HEIGHT;

  // Draw vertical lines
  for (let x = bounds.left; x <= bounds.right + CELL_WIDTH; x += CELL_WIDTH) {
    grid.moveTo(x - x_offset, bounds.top);
    grid.lineTo(x - x_offset, bounds.bottom);
  }

  // Draw horizontal LINES
  for (let y = bounds.top; y <= bounds.bottom + CELL_HEIGHT; y += CELL_HEIGHT) {
    grid.moveTo(bounds.left, y - y_offset);
    grid.lineTo(bounds.right, y - y_offset);
  }

  if (showGridAxes) {
    grid.lineStyle(10, 0x000000, 0.35, 0, true);
    if (0 >= bounds.left && 0 <= bounds.right) {
      grid.moveTo(0, bounds.top);
      grid.lineTo(0, bounds.bottom);
    }
    if (0 >= bounds.top && 0 <= bounds.bottom) {
      grid.moveTo(bounds.left, 0);
      grid.lineTo(bounds.right, 0);
    }
  }
};

export default drawGridLines;
