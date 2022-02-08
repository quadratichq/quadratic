import { qdb, Cell } from "./db";

export const GetCellsDB = async (): Promise<Cell[]> => {
  // Return all Cells as an Array
  return await qdb.cells.toArray();
};
