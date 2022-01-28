import { Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  GRID_SIZE,
} from "../../constants/gridConstants";

import colors from "../../utils/colors.js";

const drawGrid = function (viewport: Viewport) {
  // Create a master graphics object
  let grid = new Graphics();
  // Configure Line Style
  grid.lineStyle(1, colors.gridLines, 0.5, 0.5, true);

  const xoffset = (-CELL_WIDTH * GRID_SIZE) / 2;
  const yoffset = (-CELL_HEIGHT * GRID_SIZE) / 2;

  // Draw vertical lines
  for (var i = 0; i < GRID_SIZE; i++) {
    grid.moveTo(xoffset + i * CELL_WIDTH, yoffset);
    grid.lineTo(
      xoffset + i * CELL_WIDTH,
      yoffset + CELL_HEIGHT * GRID_SIZE * 10
    );
  }

  // Draw horizontal LINES
  for (var j = 0; j < GRID_SIZE * 10; j++) {
    grid.moveTo(xoffset, yoffset + j * CELL_HEIGHT);
    grid.lineTo(xoffset + CELL_WIDTH * GRID_SIZE, yoffset + j * CELL_HEIGHT);
  }

  viewport.addChild(grid);
  return grid;
};

export default drawGrid;
