import { Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
} from '../../../constants/gridConstants';

import { colors } from '../../../theme/colors';

const drawGridLines = function (viewport: Viewport, grid: Graphics): void {
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
};

export default drawGridLines;
