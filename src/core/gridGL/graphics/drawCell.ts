import { BitmapText, Container, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";

import singleCellHighlight from "./primatives/singleCellHighlight";
import CellReference from "../types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";

interface CellReturn {
  container: Container;
  bitmap_text: BitmapText;
  cell_outline: Graphics;
}

const drawCell = (
  viewport: Viewport,
  cell: CellReference,
  text: string,
  computed: boolean
): CellReturn => {
  // Calculate X and Y positions
  const x_pos = cell.x * CELL_WIDTH;
  const y_pos = cell.y * CELL_HEIGHT;
  const margin_left = 2;
  const margin_top = -1;

  // render text
  let bitmap_text = new BitmapText(text, {
    fontName: "OpenSans",
    tint: 0x000000,
    fontSize: 14,
    align: "right",
  });
  bitmap_text.position.set(x_pos + margin_left, y_pos + margin_top);

  // highlight cell
  let cell_outline;
  if (computed) {
    cell_outline = singleCellHighlight(cell, "computed");
  } else {
    cell_outline = singleCellHighlight(cell, "normal");
  }

  // create Container
  let container = new Container();
  container.addChild(bitmap_text);
  container.addChild(cell_outline);

  return {
    container,
    bitmap_text,
    cell_outline,
  };
};

export default drawCell;
