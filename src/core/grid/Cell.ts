import { BitmapText, Container, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import CellReference from "../types/cellReference";

import drawCell from "../graphics/drawCell";

export default class Cell {
  location: CellReference;
  bitmap_text: BitmapText;
  container: Container;
  viewport: Viewport;
  cell_outline: Graphics;

  constructor(location: CellReference, viewport: Viewport, text: string) {
    this.location = location;

    // draw cell
    let { bitmap_text, container, cell_outline } = drawCell(
      viewport,
      location,
      text
    );
    this.bitmap_text = bitmap_text;
    this.container = container;
    this.cell_outline = cell_outline;
    this.viewport = viewport;
    viewport.addChild(container);
  }

  update(text: string) {
    this.bitmap_text.text = text;
  }

  destroy() {
    this.viewport.removeChild(this.container);
    this.container.destroy();
  }
}
