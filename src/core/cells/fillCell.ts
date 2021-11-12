import { BitmapText, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";

import CellReference from "../cells/types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";

import colors from "../../utils/colors.js";

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
  let cell_outline = new Graphics();
  cell_outline.lineStyle(2, colors.cellColorUserText, 0.9, 0.5, true);
  cell_outline.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);

  viewport.addChild(bitmapText);
  viewport.addChild(cell_outline);
};

export default fillCell;
