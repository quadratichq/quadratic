import Globals from "../globals";
import Cursor from "./cursor";
import MultiCursor from "./multiCursor";
import GridInput from "./input";

import isAlphaNumeric from "./helpers/isAlphaNumeric";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import { deleteCellsRange } from "../../actions/deleteCellsRange";

export default class Interaction {
  globals: Globals;
  cursor: Cursor;
  multiCursor: MultiCursor;
  input: GridInput;

  constructor(globals: Globals) {
    this.globals = globals;

    // Create Cursor
    this.cursor = new Cursor(this.globals);
    this.multiCursor = new MultiCursor(this.globals);

    // Create Input
    this.input = new GridInput(this.globals, this.cursor);
  }

  makeInteractive() {
    // This makes the canvas emit interaction events
    this.globals.canvas.setAttribute("tabindex", "1");
    this.globals.canvas.focus();

    // start cursor
    this.cursor.drawCursor();

    // General keydown listener when user is interacting with The Grid
    this.globals.canvas.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.cursor.moveCursor({
          x: this.cursor.location.x,
          y: this.cursor.location.y + 1,
        });
        this.input.moveInputToCursor();

        event.preventDefault();
      }

      if (event.key === "Backspace") {
        deleteCellsRange(
          {
            x: this.multiCursor.originLocation.x,
            y: this.multiCursor.originLocation.y,
          },
          {
            x: this.multiCursor.terminalLocation.x - 1,
            y: this.multiCursor.terminalLocation.y - 1,
          }
        );
        event.preventDefault();
      }

      this.globals.viewport.dirty = true;
    });

    this.globals.canvas.addEventListener("mousedown", (event) => {
      const { x, y } = this.globals.viewport.toWorld(event.x, event.y);
      let cell_x = Math.floor(x / CELL_WIDTH);
      let cell_y = Math.floor(y / CELL_HEIGHT);

      // set multiCell origin, draw it, make it interactive
      this.multiCursor.setOrigin({ x: cell_x, y: cell_y });
      this.multiCursor.setTerminalCell({ x: cell_x, y: cell_y });
      this.multiCursor.drawCursor();
      this.multiCursor.isInteractive = true;

      // save previous cell
      if (this.input.input.text !== "") {
        this.input.saveCell().then(() => {
          this.input.moveInputToCursor();
        });
      }

      // move single cursor to origin cell
      this.cursor.moveCursor({
        x: this.multiCursor.originLocation.x,
        y: this.multiCursor.originLocation.y,
      });

      this.globals.viewport.dirty = true;
    });

    this.globals.canvas.addEventListener("mousemove", (event) => {
      if (this.multiCursor.isInteractive) {
        // if mouse left click is down
        if (event.buttons) {
          const { x, y } = this.globals.viewport.toWorld(event.x, event.y);
          let cell_x = Math.sign(x) * Math.ceil(Math.abs(x) / CELL_WIDTH);
          let cell_y = Math.sign(y) * Math.ceil(Math.abs(y) / CELL_HEIGHT);
          this.multiCursor.setTerminalCell({ x: cell_x, y: cell_y });
          this.globals.viewport.dirty = true;
        } else {
          this.multiCursor.isInteractive = false;
        }
      }
    });

    this.globals.canvas.addEventListener("mouseup", (event) => {
      this.multiCursor.isInteractive = false;
    });

    this.globals.canvas.addEventListener("keydown", (event) => {});
  }
}
