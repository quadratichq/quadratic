import { Graphics } from "pixi.js";

import CellReference from "../../types/cellReference";

import { CELL_WIDTH, CELL_HEIGHT } from "../../../../constants/gridConstants";

import colors from "../../../../theme/colors.js";

const singleCellHighlight = (cell: CellReference, type: string): Graphics => {
  const x_pos = cell.x * CELL_WIDTH;
  const y_pos = cell.y * CELL_HEIGHT;
  // highlight cell
  let cell_outline = new Graphics();

  // set type
  if (type === "cursor") {
    cell_outline.lineStyle(1.5, colors.cursorCell);
  } else if (type === "computed") {
    cell_outline.lineStyle(1, colors.independence, 0.9, 0.5, true);
  } else {
    cell_outline.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);
  }

  cell_outline.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);

  return cell_outline;
};

export default singleCellHighlight;
