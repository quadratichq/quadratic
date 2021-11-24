import type { Graphics } from "pixi.js";
import type Globals from "../../globals";

import CellReference from "../types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";
import multipleCellHighlight from "../graphics/primatives/multipleCellHighlight";

export default class MultiCursor {
  globals: Globals;
  cursor_pixi: Graphics;
  originLocation: CellReference;
  terminalLocation: CellReference;
  isInteractive: Boolean;

  constructor(globals: Globals) {
    this.globals = globals;
    this.cursor_pixi = multipleCellHighlight({ x: 0, y: 0 }, { x: 25, y: 25 });
    this.originLocation = { x: 0, y: 0 };
    this.terminalLocation = { x: 0, y: 0 };
    this.isInteractive = false;
  }

  drawCursor() {
    this.globals.viewport.addChild(this.cursor_pixi);
    this.cursor_pixi.visible = true;
  }

  undrawCursor() {
    this.globals.viewport.removeChild(this.cursor_pixi);
  }

  setOrigin(location: CellReference) {
    this.cursor_pixi.x = location.x * CELL_WIDTH;
    this.cursor_pixi.y = location.y * CELL_HEIGHT;
    this.originLocation = location;
    this.cursor_pixi.width = 0;
    this.cursor_pixi.height = 0;
  }

  setTerminalCell(location: CellReference) {
    this.terminalLocation = location;
    this.cursor_pixi.width = location.x * CELL_WIDTH - this.cursor_pixi.x;
    this.cursor_pixi.height = location.y * CELL_HEIGHT - this.cursor_pixi.y;
  }
}
