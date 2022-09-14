import { Graphics } from 'pixi.js';

import { CELL_WIDTH, CELL_HEIGHT } from '../../../../constants/gridConstants';

import CellReference from '../../types/cellReference';

import { colors } from '../../../../theme/colors.js';

const multipleCellHighlight = (cell0: CellReference, cell1: CellReference): Graphics => {
  const x0_pos = cell0.x * CELL_WIDTH;
  const y0_pos = cell0.y * CELL_HEIGHT;
  const x1_pos = cell1.x * CELL_WIDTH;
  const y1_pos = cell1.y * CELL_HEIGHT;

  // highlight cells
  let cell_outline = new Graphics();
  cell_outline.lineStyle(1, colors.cursorCell, 1, 0, true);
  cell_outline.beginFill(colors.cursorCell, 0.1);
  cell_outline.drawRect(x0_pos, y0_pos, x1_pos - x0_pos, y1_pos - y0_pos);

  return cell_outline;
};

export default multipleCellHighlight;
