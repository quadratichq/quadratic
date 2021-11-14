// @ts-ignore
import TextInput from "pixi-text-input";

import Globals from "../../globals";
import Cursor from "../interaction/cursor";

import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";

export default class GridInput {
  globals: Globals;
  cursor: Cursor;
  input: any;

  constructor(globals: Globals, cursor: Cursor) {
    this.globals = globals;
    this.cursor = cursor;
    // @ts-ignore
    let input = new TextInput({
      input: {
        // fontFamily: "OpenSans",
        fontSize: "14px",
        padding: "12px",
      },
    });

    this.input = input;
    this.globals.viewport.addChild(input);

    input.alpha = 0;

    input.on("input", (text: string) => {
      this.globals.grid.createOrUpdateCell(
        { x: input.last_x, y: input.last_y },
        text
      );
      if (input.text === "") {
        this.globals.grid.destroyCell({ x: input.last_x, y: input.last_y });
      }
    });

    input.on("keydown", (keycode: number) => {
      console.log(keycode);
      // if enter is pressed
      if (keycode === 13) {
        // focus input one down
        cursor.moveCursor({
          x: cursor.location.x,
          y: cursor.location.y + 1,
        });
        // viewport.removeChild(input);
        this.globals.canvas.focus();
      }
      // esc
      if (keycode === 27) {
        // cleanup
        input.text = "";
        // this.globals.viewport.removeChild(input);
        this.globals.canvas.focus();
      }
      // tab
      if (keycode === 9) {
        // focus input one to the right
        cursor.moveCursor({
          x: cursor.location.x + 1,
          y: cursor.location.y,
        });
        this.moveInputToCursor();

        // TODO: this moves focus to the URL bar, we need to prevent this
      }

      // upArrow
      if (keycode === 38) {
        cursor.moveCursor({
          x: cursor.location.x,
          y: cursor.location.y - 1,
        });
        // viewport.removeChild(input);
        this.globals.canvas.focus();
      }
      // downArrow
      if (keycode === 40) {
        cursor.moveCursor({
          x: cursor.location.x,
          y: cursor.location.y + 1,
        });
        // viewport.removeChild(input);
        this.globals.canvas.focus();
      }
    });
  }

  moveInputToCursor() {
    let cell_x = this.cursor.location.x;
    let cell_y = this.cursor.location.y;

    // Move input
    const cell = this.globals.grid.getCell({ x: cell_x, y: cell_y });
    if (this.globals.grid.getCell({ x: cell_x, y: cell_y }) !== null) {
      this.input.text = cell?.bitmap_text.text;
    } else {
      this.input.text = "";
    }

    // input.placeholder = "Type or press'/'";
    this.input.x = 0.38 + cell_x * CELL_WIDTH;
    this.input.y = 0.44 + cell_y * CELL_HEIGHT;
    this.input.width = 100;
    this.input.height = 20;
    this.input.last_x = cell_x;
    this.input.last_y = cell_y;
    this.input.focus();
  }
}
