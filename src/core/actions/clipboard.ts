import { Coordinate } from '../gridGL/types/size';
import { Cell } from '../gridDB/gridTypes';
import { SheetController } from '../transaction/sheetController';
import { updateCellAndDCells } from './updateCellAndDCells';
import { DeleteCells } from '../gridDB/Cells/DeleteCells';

const pasteFromTextHtml = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
  try {
    const clipboard_data = await navigator.clipboard.read();
    // Attempt to read Quadratic data from clipboard
    for (let i = 0; i < clipboard_data.length; i++) {
      const item = clipboard_data[i];
      const item_blob = await item.getType('text/html');
      let item_text = await item_blob.text();

      // strip html tags
      item_text = item_text.replace(/(<([^>]+)>)/gi, '');

      // parse json from text
      let json = JSON.parse(item_text);

      if (json.type === 'quadratic/clipboard') {
        const x_offset = pasteToCell.x - json.cell0.x;
        const y_offset = pasteToCell.y - json.cell0.y;

        let cells_to_update: Cell[] = [];
        json.copiedCells.forEach((cell: Cell) => {
          cells_to_update.push({
            x: cell.x + x_offset,
            y: cell.y + y_offset,
            type: cell.type,
            value: cell.value,
            python_code: cell.python_code,
            last_modified: new Date().toISOString(),
          });
        });

        await updateCellAndDCells({
          starting_cells: cells_to_update,
          sheetController: sheet_controller,
        });

        return true; // successful don't continue
      }
    }
    return false; // unsuccessful
  } catch {
    return false; // unsuccessful
  }
};

const pasteFromText = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
  try {
    // attempt to read text from clipboard
    const clipboard_text = await navigator.clipboard.readText();
    let cell_x: number = pasteToCell.x;
    let cell_y: number = pasteToCell.y;

    // build api payload
    let cells_to_write: Cell[] = [];
    let cells_to_delete: Coordinate[] = [];

    let str_rows: string[] = clipboard_text.split('\n');

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

    // TODO ALSO BE ABLE TO PASS CELLS TO DELETE TO updatecellandcells

    // bulk update and delete cells
    await updateCellAndDCells({
      starting_cells: cells_to_write,
      sheetController: sheet_controller,
    });

    // cells_to_delete

    return true; // unsuccessful
  } catch {
    return false; // unsuccessful
  }
};

export const pasteFromClipboard = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
  if (navigator.clipboard && window.ClipboardItem) {
    let success = false;

    // attempt to read Quadratic data from clipboard
    success = await pasteFromTextHtml(sheet_controller, pasteToCell);
    if (success) return;

    // attempt to read tabular text from clipboard
    success = await pasteFromText(sheet_controller, pasteToCell);
    if (success) return;
  }
};

export const copyToClipboard = async (sheet_controller: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  // write selected cells to clipboard

  const cWidth = Math.abs(cell1.x - cell0.x) + 1;
  const cHeight = Math.abs(cell1.y - cell0.y) + 1;

  let clipboardString = '';
  let copiedCells: Cell[] = [];

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

      const cell = sheet_controller.sheet.getCellCopy(cell_x, cell_y);

      if (cell) {
        clipboardString += cell?.value || '';
        copiedCells.push({
          x: cell.x,
          y: cell.y,
          type: cell.type,
          value: cell.value,
          python_code: cell.python_code,
        });
      }
    }
  }

  const quadraticString = JSON.stringify({
    type: 'quadratic/clipboard',
    copiedCells,
    cell0,
    cell1,
  });

  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  if (navigator.clipboard && window.ClipboardItem) {
    // browser support clipboard apinavigator.clipboard
    navigator.clipboard.write([
      new ClipboardItem({
        //@ts-ignore
        'text/html': new Blob([quadraticString], { type: 'text/html' }),
        //@ts-ignore
        'text/plain': new Blob([clipboardString], { type: 'text/plain' }),
      }),
    ]);
  } else {
    // fallback to textarea
    const textarea = document.createElement('textarea');
    textarea.value = clipboardString;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

export const cutToClipboard = async (sheet_controller: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  // copy selected cells to clipboard
  await copyToClipboard(sheet_controller, cell0, cell1);

  // delete selected cells
  await DeleteCells({
    x0: cell0.x,
    y0: cell0.y,
    x1: cell1.x,
    y1: cell1.y,
    sheetController: sheet_controller,
    app: sheet_controller.app,
  });
};
