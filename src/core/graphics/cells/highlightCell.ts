import { Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";

import CellReference from "./types/cellReference";

import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";

import colors from "../../../utils/colors.js";

const highlightCell = (
  viewport: Viewport,
  cell: CellReference,
  type: string
) => {
  const x_pos = cell.x * CELL_WIDTH;
  const y_pos = cell.y * CELL_HEIGHT;
  // highlight cell
  let cell_outline = new Graphics();
  cell_outline.lineStyle(1, colors.cellColorUserText, 0.9, 0.5, true);
  cell_outline.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);
  viewport.addChild(cell_outline);
};

export default highlightCell;
