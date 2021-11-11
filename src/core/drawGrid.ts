import { Sprite, Texture, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";

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

  const cell_width = 100;
  const cell_height = 20;
  const grid_size = 10000;

  const xoffset = (-cell_width * grid_size) / 2;
  const yoffset = (-cell_height * grid_size) / 2;

  // Draw vertical lines
  for (var i = 0; i < grid_size; i++) {
    graphics.moveTo(xoffset + i * cell_width, yoffset);
    graphics.lineTo(xoffset + i * cell_width, cell_height * grid_size);
  }

  // Draw vertical lines
  for (var j = 0; j < grid_size; j++) {
    graphics.moveTo(xoffset, yoffset + j * cell_height);
    graphics.lineTo(cell_width * grid_size, yoffset + j * cell_height);
  }

  viewport.addChild(graphics);
};

export default drawGrid;
