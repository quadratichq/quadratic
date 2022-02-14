import { qdb } from "./db";
import CellReference from "../gridGL/types/cellReference";

export const DeleteCellsDB = async (cells: CellReference[]) => {
  let cellIDs = cells.map((cell) => {
    return [cell.x, cell.y];
  });

  return await qdb.cells.bulkDelete(cellIDs);
};
