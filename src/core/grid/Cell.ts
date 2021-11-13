import { BitmapText } from "pixi.js";
import { Viewport } from "pixi-viewport";
import CellReference from "../types/cellReference";

import drawCell from "../graphics/cells/drawCell";

export default class Cell {
  location: CellReference;
  bitmap_text: BitmapText;

  constructor(location: CellReference, viewport: Viewport, text: string) {
    this.location = location;

    // draw cell
    let { bitmap_text, container } = drawCell(viewport, location, text);
    this.bitmap_text = bitmap_text;
    viewport.addChild(container);
  }

  update(text: string) {
    this.bitmap_text.text = text;
  }
}
