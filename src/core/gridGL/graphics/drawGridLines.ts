import { Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  GRID_SIZE,
} from '../../../constants/gridConstants';

import { colors } from '../../../theme/colors';

const drawGridLines = function (viewport: Viewport) {
  // Create a master graphics object
  let grid = new Graphics();
  // Configure Line Style
  grid.lineStyle(1, colors.gridLines, 0.25, 0.5, true);

  const offsets = getOffsets(viewport);
  const xoffset = offsets.x
  const yoffset = offsets.y

  // Draw vertical lines
  for (var i = 0; i < GRID_SIZE / 2; i++) {
    grid.moveTo(xoffset + i * CELL_WIDTH, yoffset);
    grid.lineTo(
      xoffset + i * CELL_WIDTH,
      yoffset + CELL_HEIGHT * GRID_SIZE * 5
    );
  }

  // Draw horizontal LINES
  for (var j = 0; j < GRID_SIZE * 2; j++) {
    grid.moveTo(xoffset, yoffset + j * CELL_HEIGHT);
    grid.lineTo(xoffset + CELL_WIDTH * GRID_SIZE, yoffset + j * CELL_HEIGHT);
  }

  viewport.addChild(grid);
  return grid;
};

// Calculates the x and y offsets based on the viewport's visible bounds
const getOffsets = function (viewport: Viewport) {
  const visibleBounds = viewport.getVisibleBounds();

  const xoffset = Math.round((visibleBounds.x - visibleBounds.width / 2) / CELL_WIDTH) * CELL_WIDTH; // matching alignment by rounding to nearest cell width value
  const yoffset = Math.round((visibleBounds.y - visibleBounds.height / 2) / CELL_HEIGHT) * CELL_HEIGHT;  // matching aligment by rounding to nearest cell height value

  return {
    x: xoffset,
    y: yoffset,
  };
}

// moves the grid around to match the viewport
export const moveGrid = function (viewport: Viewport, grid: Graphics) {
  const offsets = getOffsets(viewport)
  grid.transform.position.set(offsets.x, offsets.y);
}

export default drawGridLines;
