import { GetCellsDB } from "../gridDB/GetCellsDB";
import { DeleteCellsDB } from "../gridDB/DeleteCellsDB";
import CellReference from "../gridGL/types/cellReference";

export const deleteCellsRange = async (
  p0: CellReference,
  p1: CellReference
) => {
  const cells = await GetCellsDB(p0.x, p0.y, p1.x, p1.y);
  DeleteCellsDB(cells);
};
