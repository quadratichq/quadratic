import Globals from "../../globals";
import { getCells } from "../api/APIClient";
import CellReference from "../types/cellReference";

export const loadCells = async (
  point0: CellReference,
  point1: CellReference,
  globals: Globals
) => {
  const data = await getCells(point0, point1);
  if (data !== null) {
    data.forEach((cell: any) => {
      globals.grid.createOrUpdateCell(
        { x: parseInt(cell.x), y: parseInt(cell.y) },
        cell.input_value
      );
    });
  }
};
