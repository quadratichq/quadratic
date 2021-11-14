import type { Graphics } from "pixi.js";
import type Globals from "../../globals";

import CellReference from "../types/cellReference";
import highlightCell from "../../core/graphics/cells/highlightCell";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";

export default class Interaction {
  globals: Globals;
  cursor_pixi: Graphics;
  location: CellReference;

  constructor(globals: Globals) {
    this.globals = globals;
    this.cursor_pixi = highlightCell({ x: 0, y: 0 }, "cursor");
    this.location = { x: 0, y: 0 };
  }

  drawCursor() {
    this.globals.viewport.addChild(this.cursor_pixi);
  }

  undrawCursor() {
    this.globals.viewport.removeChild(this.cursor_pixi);
  }

  moveCursor(location: CellReference) {
    this.location = location;

    this.cursor_pixi.x = location.x * CELL_WIDTH;
    this.cursor_pixi.y = location.y * CELL_HEIGHT;
  }
}
