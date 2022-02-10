import { qdb, Cell } from "./db";

export const UpdateCellsDB = async (cells: Cell[]) => {
  return await qdb.cells.bulkPut(cells);
};
