import Grid from "../grid/Grid";
import CellReference from "../types/cellReference";
import { updateCells } from "../api/APIClient";

export const pasteFromClipboard = (pasteToCell: CellReference, grid: Grid) => {
  // get contents from clipboard
  navigator.clipboard.readText().then((text) => {
    let cell_x: number = pasteToCell.x;
    let cell_y: number = pasteToCell.y;

    let str_rows: string[] = text.split("\n");

    // for each copied row
    str_rows.forEach((str_row) => {
      let str_cells: string[] = str_row.split("\t");

      // for each copied cell
      str_cells.forEach((str_cell) => {
        // draw cell
        grid.createOrUpdateCell({ x: cell_x, y: cell_y }, str_cell);

        // update cell on API
        updateCells([
          {
            x: cell_x,
            y: cell_y,
            input_type: "TEXT",
            input_value: str_cell,
          },
        ]);

        // move to next cell
        cell_x += 1;
      });

      // move to next row and return
      cell_y += 1;
      cell_x = pasteToCell.x;
    });
  });
};
