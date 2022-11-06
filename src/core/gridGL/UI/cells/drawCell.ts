import { Graphics } from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { Cell } from '../../../gridDB/db';
import { GridOffsets } from '../../../gridDB/tempGridOffsets';

export function drawCell(options: {
  graphics: Graphics;
  cell: Cell;
  x: number;
  y: number;
  width: number;
  height: number;
  gridOffsets: GridOffsets;
}): void {
  const { graphics, cell, x, y, width, height, gridOffsets } = options;
  // Change outline color based on cell type but don't draw TEXT cell outlines since it's handled by the grid
  if (cell.type !== 'TEXT') {
    // g.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);

    if (cell.type === 'PYTHON') {
      graphics.lineStyle(1, colors.cellColorUserPython, 0.75, 0.5, true);
    } else if (cell.type === 'COMPUTED') {
      graphics.lineStyle(1, colors.independence, 0.75, 0.5, true);
    }

    // Draw outline
    graphics.drawRect(x, y, width, height);
  }

  // for cells that output an array, draw an outline around the array
  if (!cell.array_cells) return;

  // calculate array cells outline size
  let xEnd = x + width;
  let yEnd = y + height;
  for (let i = 0; i < cell.array_cells.length; i++) {
    const arrayCells = cell.array_cells[i];
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
