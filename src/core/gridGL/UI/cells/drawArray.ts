import { Graphics } from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { PixiApp } from '../../pixiApp/PixiApp';

// todo: use sprites instead of Graphics like CellsDraw

export function drawArray(options: {
  app: PixiApp;
  graphics: Graphics;
  cellArray: number[][];
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  const { graphics, cellArray, x, y, width, height, app } = options;
  const gridOffsets = app.gridOffsets;

  // calculate array cells outline size
  let xEnd = x + width;
  let yEnd = y + height;
  for (let i = 0; i < cellArray.length; i++) {
    const arrayCells = cellArray[i];
    const xPlacement = gridOffsets.getColumnPlacement(arrayCells[0]);
    xEnd = Math.max(xPlacement.x + xPlacement.width, xEnd);
    const yPlacement = gridOffsets.getRowPlacement(arrayCells[1]);
    yEnd = Math.max(yPlacement.y + yPlacement.height, yEnd);
  }

  // draw array cells outline
  graphics.lineStyle(1, colors.cellColorUserPython, 0.35, 0, false);
  graphics.drawRect(x, y, xEnd - x, yEnd - y);

  // double outline the master cell
  graphics.lineStyle(1, colors.cellColorUserPython, 0.25, 0, false);
  graphics.drawRect(x, y, width, height);
}
