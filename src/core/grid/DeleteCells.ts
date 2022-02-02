import { qdb } from "../database/db";
import CellReference from "../../grid/types/cellReference";

export const DeleteCells = async (cells: CellReference[]) => {
  let cellIDs = cells.map((cell) => {
    return [cell.x, cell.y];
  });

  return await qdb.cells.bulkDelete(cellIDs);
};
