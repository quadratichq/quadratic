import { qdb, Cell } from "./db";

export const UpdateCells = async (cells: Cell[]) => {
  return await qdb.cells.bulkPut(cells);
};
