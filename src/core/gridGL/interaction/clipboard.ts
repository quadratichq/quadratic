import CellReference from "../types/cellReference";
import { Cell } from "../../gridDB/db";
import { UpdateCellsDB } from "../../gridDB/UpdateCellsDB";
import { DeleteCellsDB } from "../../gridDB/DeleteCellsDB";

export const pasteFromClipboard = (pasteToCell: CellReference) => {
  // get contents from clipboard
  navigator.clipboard.readText().then((text) => {
    let cell_x: number = pasteToCell.x;
    let cell_y: number = pasteToCell.y;

    // build api payload
    let cells_to_write: Cell[] = [];
    let cells_to_delete: CellReference[] = [];

    let str_rows: string[] = text.split("\n");

    // for each copied row
    str_rows.forEach((str_row) => {
      let str_cells: string[] = str_row.split("\t");

      // for each copied cell
      str_cells.forEach((str_cell) => {
        // update or clear cell
        if (str_cell !== "") {
          // draw updated cell
          // grid.createOrUpdateCell({ x: cell_x, y: cell_y }, str_cell);
          // // update cell on API
          // cells_to_write.push({
          //   x: cell_x,
          //   y: cell_y,
          //   type: "TEXT",
          //   value: str_cell,
          // });
        } else {
          // grid.destroyCell({ x: cell_x, y: cell_y });
          // cells_to_delete.push({
          //   x: cell_x,
          //   y: cell_y,
          // });
        }

        // move to next cell
        cell_x += 1;
      });

      // move to next row and return
      cell_y += 1;
      cell_x = pasteToCell.x;
    });

    // bulk update and delete cells on api
    UpdateCellsDB(cells_to_write);
    DeleteCellsDB(cells_to_delete);
  });
};

export const copyToClipboard = (cell0: CellReference, cell1: CellReference) => {
  // write selected cells to clipboard

  const cWidth = Math.abs(cell1.x - cell0.x);
  const cHeight = Math.abs(cell1.y - cell0.y);

  let clipboardString = "";

  for (let offset_y = 0; offset_y < cHeight; offset_y++) {
    if (offset_y > 0) {
      clipboardString += "\n";
    }

    for (let offset_x = 0; offset_x < cWidth; offset_x++) {
      let cell_x = cell0.x + offset_x;
      let cell_y = cell0.y + offset_y;

      if (offset_x > 0) {
        clipboardString += "\t";
      }

      clipboardString += "";
    }
  }

  navigator.clipboard.writeText(clipboardString);
};
