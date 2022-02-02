import { qdb, Cell } from "../database/db";

export const UpdateCells = async (cells: Cell[]) => {
  return await qdb.cells.bulkPut(cells);
};
