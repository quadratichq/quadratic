import type { Graphics } from "pixi.js";
import { BitmapText } from "pixi.js";
import type Globals from "../globals";

import CellReference from "../types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import singleCellHighlight from "../graphics/primatives/singleCellHighlight";
import colors from "../../../theme/colors";

export default class Cursor {
  globals: Globals;
  cursor_pixi: Graphics;
  location: CellReference;
  text_pixi: BitmapText;

  constructor(globals: Globals) {
    this.globals = globals;
    this.cursor_pixi = singleCellHighlight({ x: 0, y: 0 }, "cursor");
    this.location = { x: 0, y: 0 };

    this.text_pixi = new BitmapText(`0, 0`, {
      fontName: "OpenSans",
      fontSize: 8,
      tint: colors.cursorCell,
      align: "left",
      // maxWidth: 100,
    });
  }

  drawCursor() {
    this.globals.viewport.addChild(this.cursor_pixi);
    this.globals.viewport.addChild(this.text_pixi);
  }

  undrawCursor() {
    this.globals.viewport.removeChild(this.cursor_pixi);
    this.globals.viewport.removeChild(this.text_pixi);
  }

  moveCursor(location: CellReference) {
    this.location = location;

    this.cursor_pixi.visible = true;
    this.cursor_pixi.x = location.x * CELL_WIDTH;
    this.cursor_pixi.y = location.y * CELL_HEIGHT;

    this.text_pixi.text = `(${location.x}, ${location.y})`;
    this.text_pixi.x = location.x * CELL_WIDTH;
    this.text_pixi.y = location.y * CELL_HEIGHT - 12;
    this.text_pixi.visible = true;

    // ensure the cursor remains visible when moving past the edges of the screen
    this.globals.viewport.ensureVisible(
      this.cursor_pixi.x,
      this.cursor_pixi.y,
      this.cursor_pixi.width,
      this.cursor_pixi.height,
      false
    );
  }
}
