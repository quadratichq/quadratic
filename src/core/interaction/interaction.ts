import Globals from "../../globals";
import Cursor from "./cursor";
import MultiCursor from "./multiCursor";
import Input from "./input";

import isAlphaNumeric from "./helpers/isAlphaNumeric";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";
import { copyToClipboard, pasteFromClipboard } from "./clipboard";
export default class Interaction {
  globals: Globals;
  cursor: Cursor;
  multiCursor: MultiCursor;
  input: Input;

  constructor(globals: Globals) {
    this.globals = globals;

    // Create Cursor
    this.cursor = new Cursor(this.globals);
    this.multiCursor = new MultiCursor(this.globals);

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
      // Prevent these commands if "command" key is being pressed
      if (event.metaKey) {
        return;
      }

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

      if (event.key === "Backspace") {
        this.globals.grid.destroyCells(
          {
            x: this.multiCursor.originLocation.x,
            y: this.multiCursor.originLocation.y,
          },
          {
            x: this.multiCursor.terminalLocation.x,
            y: this.multiCursor.terminalLocation.y,
          }
        );
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
        this.input.setGridToInput();
        event.preventDefault();
      }
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
      this.input.moveInputToCursor();
      this.input.saveCell();

      // move single cursor to origin cell
      this.cursor.moveCursor({
        x: this.multiCursor.originLocation.x,
        y: this.multiCursor.originLocation.y,
      });
    });

    this.globals.canvas.addEventListener("mousemove", (event) => {
      if (this.multiCursor.isInteractive) {
        // if mouse left click is down
        if (event.buttons) {
          const { x, y } = this.globals.viewport.toWorld(event.x, event.y);
          let cell_x = Math.sign(x) * Math.ceil(Math.abs(x) / CELL_WIDTH);
          let cell_y = Math.sign(y) * Math.ceil(Math.abs(y) / CELL_HEIGHT);
          this.multiCursor.setTerminalCell({ x: cell_x, y: cell_y });
        } else {
          this.multiCursor.isInteractive = false;
        }
      }
    });

    this.globals.canvas.addEventListener("mouseup", (event) => {
      this.multiCursor.isInteractive = false;
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        // save previous cell
        this.input.moveInputToCursor();
        this.input.saveCell();

        this.globals.canvas.focus();

        // move single cursor one right
        this.cursor.moveCursor({
          x: this.cursor.location.x + 1,
          y: this.cursor.location.y,
        });
        event.preventDefault();
      }

      // TODO make commands work cross platform
      // Command + V
      if (event.metaKey && event.code === "KeyV") {
        pasteFromClipboard(
          {
            x: this.cursor.location.x,
            y: this.cursor.location.y,
          },
          this.globals.grid
        );
      }

      // Command + C
      if (event.metaKey && event.code === "KeyC") {
        copyToClipboard(
          {
            x: this.multiCursor.originLocation.x,
            y: this.multiCursor.originLocation.y,
          },
          {
            x: this.multiCursor.terminalLocation.x,
            y: this.multiCursor.terminalLocation.y,
          },
          this.globals.grid
        );
      }
    });
  }
}
