import { BitmapText } from "pixi.js";
import { Viewport } from "pixi-viewport";

import CellReference from "./types/cellReference";
import highlightCell from "./highlightCell";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";

const fillCell = (viewport: Viewport, cell: CellReference, text: string) => {
  // Calculate X and Y positions
  const x_pos = cell.x * CELL_WIDTH;
  const y_pos = cell.y * CELL_HEIGHT;
  const margin_left = 2;
  const margin_top = -1;

  // render text
  let bitmapText = new BitmapText(text, {
    fontName: "OpenSans",
    tint: 0x000000,
    fontSize: 14,
    align: "right",
  });
  bitmapText.position.set(x_pos + margin_left, y_pos + margin_top);

  // highlight cell
  highlightCell(viewport, cell, "normal");

  viewport.addChild(bitmapText);
  return bitmapText;
};

export default fillCell;
