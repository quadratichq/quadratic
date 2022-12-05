import { qdb, Cell } from '../db';

export const GetCellsDB = (p0_x = -Infinity, p0_y = -Infinity, p1_x = Infinity, p1_y = Infinity): Cell[] => {
  // Return Cells as an Array
  return qdb.cells.getCells(p0_x, p0_y, p1_x, p1_y);
};
