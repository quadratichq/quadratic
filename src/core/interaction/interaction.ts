import Globals from "../../globals";
import Cursor from "./cursor";
import Input from "./input";

import isAlphaNumeric from "./helpers/isAlphaNumeric";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";

export default class Interaction {
  globals: Globals;
  cursor: Cursor;
  input: Input;

  constructor(globals: Globals) {
    this.globals = globals;

    // Create Cursor
    this.cursor = new Cursor(this.globals);

    // Create Input
    this.input = new Input(this.globals, this.cursor);
  }

  makeInteractive() {
    // This makes the canvas emit interaction events
    this.globals.canvas.setAttribute("tabindex", "1");
    this.globals.canvas.focus();

    // start cursor
    this.cursor.drawCursor();

    // General keydown listener when user is interacting with The Grid
    this.globals.canvas.addEventListener("keydown", (event) => {
      // TODO: if cursor goes off screen, move the viewport

      if (event.key === "ArrowUp") {
        this.cursor.moveCursor({
          x: this.cursor.location.x,
          y: this.cursor.location.y - 1,
        });
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        this.cursor.moveCursor({
          x: this.cursor.location.x + 1,
          y: this.cursor.location.y,
        });
        event.preventDefault();
      }
      if (event.key === "ArrowLeft") {
        this.cursor.moveCursor({
          x: this.cursor.location.x - 1,
          y: this.cursor.location.y,
        });
        event.preventDefault();
      }
      if (event.key === "ArrowDown") {
        this.cursor.moveCursor({
          x: this.cursor.location.x,
          y: this.cursor.location.y + 1,
        });
        event.preventDefault();
      }

      if (event.key === "Enter") {
        this.input.moveInputToCursor();
        event.preventDefault();
      }

      if (event.key === "Tab") {
        this.cursor.moveCursor({
          x: this.cursor.location.x + 1,
          y: this.cursor.location.y,
        });
        event.preventDefault();
      }

      if (event.key === "Backspace") {
        this.globals.grid.destroyCell({
          x: this.cursor.location.x,
          y: this.cursor.location.y,
        });
        event.preventDefault();
      }

      // if key is a letter or enter start taking input
      if (isAlphaNumeric(event.key)) {
        this.input.moveInputToCursor();
        // Start off input with first key pressed.
        // Make sure grid updates visually with this key.
        this.input.input.text = event.key;
        this.input.syncInputAndGrid();
        event.preventDefault();
      }
    });

    // Select Active Cell
    this.globals.viewport.on("clicked", (event) => {
      // save previous cell
      this.input.saveCell();

      // figure out which cell was clicked
      let cell_x = Math.floor(event.world.x / CELL_WIDTH);
      let cell_y = Math.floor(event.world.y / CELL_HEIGHT);

      // move cursor cell
      this.cursor.moveCursor({ x: cell_x, y: cell_y });
    });
  }
}
