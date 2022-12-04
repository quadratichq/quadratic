import { qdb, Cell } from '../gridTypes';

export const GetCellsDB = async (
  p0_x = -Infinity,
  p0_y = -Infinity,
  p1_x = Infinity,
  p1_y = Infinity
): Promise<Cell[]> => {
  // Return Cells as an Array
  return await qdb.cells
    .where('x')
    .between(p0_x, p1_x, true, true)
    .and((cell) => {
      return cell.y >= p0_y && cell.y <= p1_y;
    })
    .toArray();

  // return await (
  //   await qdb.cells.toArray()
  // ).filter(({ x, y }) => p0_x <= x && x <= p1_x && p0_y <= y && y <= p1_y);
};
