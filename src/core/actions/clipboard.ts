import CellReference from '../gridGL/types/cellReference';
import { Cell } from '../gridDB/gridTypes';
import { SheetController } from '../transaction/sheetController';

export const pasteFromClipboard = (sheet_controller: SheetController, pasteToCell: CellReference) => {
  // get contents from clipboard
  navigator.clipboard.readText().then((text) => {
    let cell_x: number = pasteToCell.x;
    let cell_y: number = pasteToCell.y;

    // build api payload
    let cells_to_write: Cell[] = [];
    let cells_to_delete: CellReference[] = [];

    let str_rows: string[] = text.split('\n');

    // for each copied row
    str_rows.forEach((str_row) => {
      let str_cells: string[] = str_row.split('\t');

      // for each copied cell
      str_cells.forEach((str_cell) => {
        // update or clear cell
        if (str_cell !== '') {
          cells_to_write.push({
            x: cell_x,
            y: cell_y,
            type: 'TEXT',
            value: str_cell,
            last_modified: new Date().toISOString(),
          });
        } else {
          cells_to_delete.push({
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

    // bulk update and delete cells
    sheet_controller.start_transaction();
    cells_to_write.forEach((cell) => {
      sheet_controller.execute_statement({
        type: 'SET_CELL',
        data: {
          position: [cell.x, cell.y],
          value: cell,
        },
      });
    });
    cells_to_delete.forEach((cell) => {
      sheet_controller.execute_statement({
        type: 'SET_CELL',
        data: {
          position: [cell.x, cell.y],
          value: undefined,
        },
      });
    });
    sheet_controller.end_transaction();
  });
};

export const copyToClipboard = async (
  sheet_controller: SheetController,
  cell0: CellReference,
  cell1: CellReference
) => {
  // write selected cells to clipboard

  const cWidth = Math.abs(cell1.x - cell0.x) + 1;
  const cHeight = Math.abs(cell1.y - cell0.y) + 1;

  let clipboardString = '';

  for (let offset_y = 0; offset_y < cHeight; offset_y++) {
    if (offset_y > 0) {
      clipboardString += '\n';
    }

    for (let offset_x = 0; offset_x < cWidth; offset_x++) {
      let cell_x = cell0.x + offset_x;
      let cell_y = cell0.y + offset_y;

      if (offset_x > 0) {
        clipboardString += '\t';
      }

      const cell = sheet_controller.sheet.getCell(cell_x, cell_y);

      if (cell) {
        clipboardString += cell.cell?.value || '';
      }
    }
  }

  navigator.clipboard.writeText(clipboardString);
};
