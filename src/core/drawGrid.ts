import { Sprite, Texture, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { CELL_WIDTH, CELL_HEIGHT, GRID_SIZE } from "../constants/gridConstants";

import colors from "../utils/colors.js";

const drawGrid = function (viewport: Viewport) {
  // add a red box
  const sprite = viewport.addChild(new Sprite(Texture.WHITE));
  sprite.tint = 0xff0000;
  // sprite.width = sprite.height = 100;
  sprite.position.set(100, 100);

  const sprite2 = viewport.addChild(new Sprite(Texture.WHITE));
  sprite2.tint = 0xff0000;
  sprite.width = sprite.height = 100;
  sprite2.position.set(0, 0);

  // Attempt to Draw a Line
  // Create a master graphics object
  let graphics = new Graphics();
  // Configure Line Style
  graphics.lineStyle(1, colors.gridLines, 0.2, 0.5, true);

  const xoffset = (-CELL_WIDTH * GRID_SIZE) / 2;
  const yoffset = (-CELL_HEIGHT * GRID_SIZE) / 2;

  // Draw vertical lines
  for (var i = 0; i < GRID_SIZE; i++) {
    graphics.moveTo(xoffset + i * CELL_WIDTH, yoffset);
    graphics.lineTo(xoffset + i * CELL_WIDTH, CELL_HEIGHT * GRID_SIZE);
  }

  // Draw vertical LINES
  for (var j = 0; j < GRID_SIZE; j++) {
    graphics.moveTo(xoffset, yoffset + j * CELL_HEIGHT);
    graphics.lineTo(CELL_WIDTH * GRID_SIZE, yoffset + j * CELL_HEIGHT);
  }

  viewport.addChild(graphics);
};

export default drawGrid;
