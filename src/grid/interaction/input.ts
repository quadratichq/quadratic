// @ts-ignore
import TextInput from "pixi-text-input";

import Globals from "../globals";
import Cursor from "./cursor";

import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";
import { apiUpdateCells } from "../api/APIClient";
export default class GridInput {
  globals: Globals;
  cursor: Cursor;
  input: TextInput;

  constructor(globals: Globals, cursor: Cursor) {
    this.globals = globals;
    this.cursor = cursor;
    // @ts-ignore
    this.input = new TextInput({
      input: {
        // fontFamily: "OpenSans",
        fontSize: "14px",
        padding: "12px",
      },
    });
    this.globals.viewport.addChild(this.input);

    this.input.alpha = 0;

    this.input.on("input", (text: string) => {
      this.setGridToInput();
    });

    this.input.on("keydown", (keycode: number) => {
      // if enter is pressed
      if (keycode === 13) {
        this.saveCell();
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
        this.saveCell();
        // cleanup
        this.input.text = "";
        // this.globals.viewport.removeChild(input);
        this.globals.canvas.focus();
      }

      // upArrow
      if (keycode === 38) {
        this.saveCell();
        cursor.moveCursor({
          x: cursor.location.x,
          y: cursor.location.y - 1,
        });
        // viewport.removeChild(input);
        this.globals.canvas.focus();
      }
      // downArrow
      if (keycode === 40) {
        this.saveCell();
        cursor.moveCursor({
          x: cursor.location.x,
          y: cursor.location.y + 1,
        });
        // viewport.removeChild(input);
        this.globals.canvas.focus();
      }
    });
  }

  setGridToInput() {
    this.globals.grid.createOrUpdateCell(
      { x: this.input.last_x, y: this.input.last_y },
      this.input.text
    );
    if (this.input.text === "") {
      this.globals.grid.destroyCell({
        x: this.input.last_x,
        y: this.input.last_y,
      });
    }
  }

  saveCell() {
    // Triggered after editing a cell
    // Calls API to update cell.
    if (this.input.text === "") {
      this.globals.grid.destroyCell({
        x: this.cursor.location.x,
        y: this.cursor.location.y,
      });
    } else {
      apiUpdateCells([
        {
          x: this.cursor.location.x,
          y: this.cursor.location.y,
          input_type: "TEXT",
          input_value: this.input.text,
        },
      ]);
    }
  }

  moveInputToCursor() {
    let cell_x = this.cursor.location.x;
    let cell_y = this.cursor.location.y;

    // Move input
    const cell = this.globals.grid.getCell({ x: cell_x, y: cell_y });
    if (this.globals.grid.getCell({ x: cell_x, y: cell_y }) !== null) {
      this.input.text = cell?.bitmap_text?.text || "";
    } else {
      this.input.text = "";
    }

    // input.placeholder = "Type or press'/'";
    this.input.visible = true;
    this.input.x = 0.38 + cell_x * CELL_WIDTH;
    this.input.y = 0.44 + cell_y * CELL_HEIGHT;
    this.input.width = 100;
    this.input.height = 20;
    this.input.last_x = cell_x;
    this.input.last_y = cell_y;
    this.input.focus();
  }
}
