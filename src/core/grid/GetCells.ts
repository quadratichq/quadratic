import { qdb, Cell } from "../database/db";

export const GetCells = async (): Promise<Cell[]> => {
  // Return all Cells as an Array
  return await qdb.cells.toArray();
};
