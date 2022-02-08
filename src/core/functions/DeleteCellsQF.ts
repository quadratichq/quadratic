import CellReference from "../gridGL/types/cellReference";
import { DeleteCellsDB } from "../gridDB/DeleteCellsDB";

export const DeleteCellsQF = (cells: CellReference[]) => {
  //DeleteCellSGM(cells);
  DeleteCellsDB(cells);
};
