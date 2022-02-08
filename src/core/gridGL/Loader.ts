import Globals from "./globals";
import { GetCellsDB } from "../gridDB/GetCellsDB";
import CellReference from "./types/cellReference";

export const loadCells = async (
  point0: CellReference,
  point1: CellReference,
  globals: Globals
) => {
  const data = await GetCellsDB();
  if (data !== null) {
    data.forEach((cell: any) => {
      globals.grid.createOrUpdateCell(
        { x: parseInt(cell.x), y: parseInt(cell.y) },
        cell.value
      );
    });
  }
};
