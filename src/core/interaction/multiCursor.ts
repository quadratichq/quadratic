import type { Graphics } from "pixi.js";
import type Globals from "../../globals";

import CellReference from "../types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";
import multipleCellHighlight from "../graphics/primatives/multipleCellHighlight";

export default class MultiCursor {
  globals: Globals;
  cursor_pixi: Graphics;
  location: CellReference;

  constructor(globals: Globals) {
    this.globals = globals;
    this.cursor_pixi = multipleCellHighlight({ x: 0, y: 0 }, { x: 25, y: 25 });
    this.location = { x: 0, y: 0 };
  }

  drawCursor() {
    this.globals.viewport.addChild(this.cursor_pixi);
  }

  undrawCursor() {
    this.globals.viewport.removeChild(this.cursor_pixi);
  }

  setOrigin(location: CellReference) {
    this.cursor_pixi.x = location.x * CELL_WIDTH;
    this.cursor_pixi.y = location.y * CELL_HEIGHT;
  }

  moveCursor(location: CellReference) {
    this.location = location;

    this.cursor_pixi.width = location.x * CELL_WIDTH - this.cursor_pixi.x;
    this.cursor_pixi.height = location.y * CELL_HEIGHT - this.cursor_pixi.y;

    // ensure the cursor remains visible when moving past the edges of the screen
    // this.globals.viewport.ensureVisible(
    //   this.cursor_pixi.x,
    //   this.cursor_pixi.y,
    //   this.cursor_pixi.width,
    //   this.cursor_pixi.height,
    //   false
    // );
  }
}
