import Grid from "../grid/Grid";
import CellReference from "../types/cellReference";
import { apiDeleteCells, apiUpdateCells } from "../api/APIClient";
import APICell from "../api/interfaces/APICell";
import APIDeleteCell from "../api/interfaces/APIDeleteCell";

export const pasteFromClipboard = (pasteToCell: CellReference, grid: Grid) => {
  // get contents from clipboard
  navigator.clipboard.readText().then((text) => {
    let cell_x: number = pasteToCell.x;
    let cell_y: number = pasteToCell.y;

    // build api payload
    let api_cells_to_write: APICell[] = [];
    let api_cells_to_delete: APIDeleteCell[] = [];

    let str_rows: string[] = text.split("\n");

    // for each copied row
    str_rows.forEach((str_row) => {
      let str_cells: string[] = str_row.split("\t");

      // for each copied cell
      str_cells.forEach((str_cell) => {
        // update or clear cell
        if (str_cell !== "") {
          // draw updated cell
          grid.createOrUpdateCell({ x: cell_x, y: cell_y }, str_cell);
          // update cell on API
          api_cells_to_write.push({
            x: cell_x,
            y: cell_y,
            input_type: "TEXT",
            input_value: str_cell,
          });
        } else {
          grid.destroyCell({ x: cell_x, y: cell_y });
          api_cells_to_delete.push({
            x: cell_x,
            y: cell_y,
          });
        }

        // move to next cell
        cell_x += 1;
      });

      // move to next row and return
      cell_y += 1;
      cell_x = pasteToCell.x;
    });

    // bulk update and delete cells on api
    apiUpdateCells(api_cells_to_write);
    apiDeleteCells(api_cells_to_delete);
  });
};

export const copyToClipboard = (
  cell0: CellReference,
  cell1: CellReference,
  grid: Grid
) => {
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

      clipboardString +=
        grid.getCell({ x: cell_x, y: cell_y })?.bitmap_text.text || "";
    }
  }

  navigator.clipboard.writeText(clipboardString);
};
