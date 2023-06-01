import { Coordinate } from '../../../gridGL/types/size';
import { Border, Cell, CellFormat } from '../../../schemas';
import { SheetController } from '../../controller/sheetController';
import { updateCellAndDCells } from '../updateCellAndDCells';
import { DeleteCells } from '../DeleteCells';
import { CellAndFormat } from '../../sheet/GridSparse';
import { Rectangle } from 'pixi.js';
import { clearFormattingAction } from '../clearFormattingAction';
import { clearBordersAction } from '../clearBordersAction';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import localforage from 'localforage';

const CLIPBOARD_FORMAT_VERSION = 'quadratic/clipboard/json/1.1';

interface ClipboardData {
  cells: CellAndFormat[];
  borders: Border[];
}

const CLIPBOARD_STORAGE_KEY = 'clipboardHtmlString';

const pasteFromTextOrHtml = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
  try {
    const clipboard_data = await navigator.clipboard.read();
    // Attempt to read Quadratic data from clipboard
    for (let i = 0; i < clipboard_data.length; i++) {
      const item = clipboard_data[i];
      if (item.types.includes('text/html')) {
        const item_blob = await item.getType('text/html');
        let item_text = await item_blob.text();

        const wasParsed = await parseHtmlString(sheet_controller, item_text, pasteToCell);

        // successful don't continue
        if (wasParsed) return true;
      }
      if (item.types.includes('text/plain')) {
        const text_blob = await item.getType('text/plain');
        let item_text = await text_blob.text();
        return pasteFromText(sheet_controller, pasteToCell, item_text);
      }
    }
    return false; // unsuccessful
  } catch {
    return false; // unsuccessful
  }
};

const pasteFromText = async (sheet_controller: SheetController, pasteToCell: Coordinate, clipboard_text: string) => {
  try {
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
  } catch (e) {
    console.log(e);
    return false; // unsuccessful
  }
};

export const pasteFromClipboard = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
  if (navigator.clipboard && window.ClipboardItem) {
    // attempt to read Quadratic data from clipboard
    return await pasteFromTextOrHtml(sheet_controller, pasteToCell);
  }
  const clipboardHtmlString = await localforage.getItem<string>(CLIPBOARD_STORAGE_KEY);
  if (!clipboardHtmlString) return false;
  return await parseHtmlString(sheet_controller, clipboardHtmlString, pasteToCell);
};

export const generateClipboardStrings = (sheet_controller: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  const cWidth = Math.abs(cell1.x - cell0.x) + 1;
  const cHeight = Math.abs(cell1.y - cell0.y) + 1;

  let plainTextClipboardString = '';
  let quadraticClipboardString: ClipboardData = {
    cells: [],
    borders: [],
  };

  // Add cells and formats to clipboard_data
  for (let offset_y = 0; offset_y < cHeight; offset_y++) {
    if (offset_y > 0) {
      plainTextClipboardString += '\n';
    }

    for (let offset_x = 0; offset_x < cWidth; offset_x++) {
      let cell_x = cell0.x + offset_x;
      let cell_y = cell0.y + offset_y;

      if (offset_x > 0) {
        plainTextClipboardString += '\t';
      }

      const cellAndFormat = sheet_controller.sheet.getCellAndFormatCopy(cell_x, cell_y);

      if (cellAndFormat) {
        plainTextClipboardString += cellAndFormat?.cell?.value || '';
        quadraticClipboardString.cells.push(cellAndFormat);
      }
    }
  }

  // create a html table string from the plain text csv string
  let htmlClipboardString = `<table><tbody><tr><td>${plainTextClipboardString
    .replace(/\n/g, '</td></tr><tr><td>')
    .replace(/\t/g, '</td><td>')}</td></tr></tbody></table>`;

  // Add borders to clipboard_data
  quadraticClipboardString.borders = sheet_controller.sheet.borders.getBorders(
    new Rectangle(cell0.x, cell0.y, cWidth, cHeight)
  );

  // remove borders that are outside the selection
  quadraticClipboardString.borders = quadraticClipboardString.borders.map((border) => {
    let border_copy = { ...border };
    // filter out horizontal borders that are after the right edge of the selection
    if (border.horizontal !== undefined && border.x > cell0.x + cWidth - 1) delete border_copy.horizontal;

    // filter out vertical borders that are after the bottom edge of the selection
    if (border.vertical !== undefined && border.y > cell0.y + cHeight - 1) delete border_copy.vertical;

    return border_copy;
  });
  // clear empty border objects
  quadraticClipboardString.borders = quadraticClipboardString.borders.filter((border) => {
    return border.horizontal !== undefined || border.vertical !== undefined;
  });

  return {
    plainTextClipboardString,
    htmlClipboardString,
    quadraticClipboardString,
  };
};

export const copyToClipboard = async (sheet_controller: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  // write selected cells to clipboard
  const { plainTextClipboardString, htmlClipboardString, quadraticClipboardString } = generateClipboardStrings(
    sheet_controller,
    cell0,
    cell1
  );

  // const quadraticString = btoa(
  //   JSON.stringify({
  //     type: CLIPBOARD_FORMAT_VERSION,
  //     data: quadraticClipboardString,
  //     cell0,
  //     cell1,
  //   })
  // );

  const encoder = new TextEncoder();
  const quadraticData = encoder.encode(
    JSON.stringify({
      type: CLIPBOARD_FORMAT_VERSION,
      data: quadraticClipboardString,
      cell0,
      cell1,
    })
  );
  const quadraticString = btoa(String.fromCharCode(...quadraticData));

  const clipboardHTMLString = `<span id="quadratic-data" data-metadata="${quadraticString}"></span>${htmlClipboardString}`;

  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  if (navigator.clipboard && window.ClipboardItem) {
    // browser support clipboard apinavigator.clipboard
    navigator.clipboard.write([
      new ClipboardItem({
        //@ts-ignore
        'text/html': new Blob([clipboardHTMLString], { type: 'text/html' }),
        //@ts-ignore
        'text/plain': new Blob([plainTextClipboardString], { type: 'text/plain' }),
      }),
    ]);
  } else {
    // fallback to localforage
    await localforage.setItem(CLIPBOARD_STORAGE_KEY, clipboardHTMLString);
  }
};

export const copySelectionToPNG = async (app: PixiApp) => {
  const blob = await copyAsPNG(app);
  if (!blob) {
    throw new Error('Unable to copy as PNG');
  }
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([
      new ClipboardItem({
        //@ts-ignore
        'image/png': blob,
      }),
    ]);
  }
};

export const cutToClipboard = async (sheet_controller: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  // copy selected cells to clipboard
  await copyToClipboard(sheet_controller, cell0, cell1);

  sheet_controller.start_transaction();

  // delete selected cells
  await DeleteCells({
    x0: cell0.x,
    y0: cell0.y,
    x1: cell1.x,
    y1: cell1.y,
    sheetController: sheet_controller,
    app: sheet_controller.app,
    create_transaction: false,
  });

  //  delete cell formats
  clearFormattingAction({ sheet_controller, start: cell0, end: cell1, create_transaction: false });

  // delete borders
  clearBordersAction({ sheet_controller, start: cell0, end: cell1, create_transaction: false });

  sheet_controller.end_transaction();
};

const parseHtmlString = async (sheet_controller: SheetController, item_text: string, pasteToCell: Coordinate) => {
  const domParser = new DOMParser();
  const html = domParser.parseFromString(item_text, 'text/html');
  const span = html.getElementById('quadratic-data');

  if (!span) return false;

  // parse json from text
  const decoder = new TextDecoder();
  const dataMetadata = span.getAttribute('data-metadata');
  if (!dataMetadata) return false;

  const quadraticData = new Uint8Array(Array.from(atob(dataMetadata), (c) => c.charCodeAt(0)));
  const decodedString = decoder.decode(quadraticData);
  const json = JSON.parse(decodedString);

  if (json.type === CLIPBOARD_FORMAT_VERSION) {
    const x_offset = pasteToCell.x - json.cell0.x;
    const y_offset = pasteToCell.y - json.cell0.y;

    let cells_to_update: Cell[] = [];
    let formats_to_update: CellFormat[] = [];
    let borders_to_update: Border[] = [];

    // Get Cell and Format data from clipboard
    json.data.cells.forEach((cellAndFormat: CellAndFormat) => {
      const cell = cellAndFormat.cell;
      const format = cellAndFormat.format;

      // transpose cells
      if (cell)
        cells_to_update.push({
          ...cell, // take old cell
          x: cell.x + x_offset, // transpose it to new location
          y: cell.y + y_offset,
          last_modified: new Date().toISOString(), // update last_modified
        });

      // transpose format
      if (format && format.x !== undefined && format.y !== undefined)
        formats_to_update.push({
          ...format, // take old format
          x: format.x + x_offset, // transpose it to new location
          y: format.y + y_offset,
        });
    });

    // border data
    json.data.borders.forEach((border: Border) => {
      // transpose borders
      // combine with existing borders
      const existingBorder = sheet_controller.sheet.borders.get(border.x + x_offset, border.y + y_offset);
      borders_to_update.push({
        ...existingBorder,
        ...border, // take old border
        x: border.x + x_offset, // transpose it to new location
        y: border.y + y_offset,
      });
    });

    // Start Transaction
    sheet_controller.start_transaction();

    // TODO: delete cells that will be overwritten
    // TODO: delete formats that will be overwritten
    // TODO: delete borders that will be overwritten

    // update cells
    await updateCellAndDCells({
      starting_cells: cells_to_update,
      sheetController: sheet_controller,
      create_transaction: false,
    });

    // update formats
    formats_to_update.forEach((format) => {
      if (format.x !== undefined && format.y !== undefined)
        sheet_controller.execute_statement({
          type: 'SET_CELL_FORMAT',
          data: {
            position: [format.x, format.y],
            value: format,
          },
        });
    });

    // update borders
    borders_to_update.forEach((border) => {
      sheet_controller.execute_statement({
        type: 'SET_BORDER',
        data: {
          position: [border.x, border.y],
          border,
        },
      });
    });

    sheet_controller.end_transaction();

    return true; // successful don't continue
  }
};
