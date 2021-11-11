import { BitmapFont, BitmapText } from "pixi.js";
import { Viewport } from "pixi-viewport";

import CellReference from "../cells/types/cellReference";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  GRID_SIZE,
} from "../../constants/gridConstants";

import colors from "../../utils/colors.js";

BitmapFont.from("CellFont", {
  fill: colors.cellFontColor,
  fontSize: 18,
});

const fillCell = function (
  viewport: Viewport,
  cell: CellReference,
  text: string
) {
  console.log("Filling Cell", cell, text);

  let bitmapText = new BitmapText(text, {
    fontName: "CellFont",
    fontSize: 18,
    align: "right",
  });
  bitmapText.position.set(cell.x * CELL_WIDTH, cell.y * CELL_HEIGHT);

  viewport.addChild(bitmapText);
};

export default fillCell;
