import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/SheetController';
import { transactionResponse } from '../../controller/transactionResponse';

// const pasteFromTextOrHtml = async (sheet_controller: SheetController, pasteToCell: Coordinate) => {
//   try {
//     const clipboard_data = await navigator.clipboard.read();
//     // Attempt to read Quadratic data from clipboard
//     for (let i = 0; i < clipboard_data.length; i++) {
//       const item = clipboard_data[i];
//       if (item.types.includes('text/html')) {
//         const item_blob = await item.getType('text/html');
//         let item_text = await item_blob.text();

//         // regex to match `--(quadratic)${quadraticString}(/quadratic)--` and extract quadraticString
//         const regex = /<span data-metadata="<--\(quadratic\)(.*)\(\/quadratic\)-->"><\/span>/g;
//         const match = regex.exec(item_text);

//         if (!match?.length) {
//           const text_blob = await item.getType('text/plain');
//           let item_text = await text_blob.text();
//           return pasteFromText(sheet_controller, pasteToCell, item_text);
//         }

//         // parse json from text
//         const decoder = new TextDecoder();
//         const quadraticData = new Uint8Array(Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
//         const decodedString = decoder.decode(quadraticData);
//         const json = JSON.parse(decodedString);

//         if (json.type === CLIPBOARD_FORMAT_VERSION) {
//           const x_offset = pasteToCell.x - json.cell0.x;
//           const y_offset = pasteToCell.y - json.cell0.y;

//           let cells_to_update: Cell[] = [];
//           let formats_to_update: CellFormat[] = [];
//           let borders_to_update: Border[] = [];

//           // Get Cell and Format data from clipboard
//           json.data.cells.forEach((cellAndFormat: CellAndFormat) => {
//             const cell = cellAndFormat.cell;
//             const format = cellAndFormat.format;

//             // transpose cells
//             if (cell)
//               cells_to_update.push({
//                 ...cell, // take old cell
//                 x: cell.x + x_offset, // transpose it to new location
//                 y: cell.y + y_offset,
//                 last_modified: new Date().toISOString(), // update last_modified
//               });

//             // transpose format
//             if (format && format.x !== undefined && format.y !== undefined)
//               formats_to_update.push({
//                 ...format, // take old format
//                 x: format.x + x_offset, // transpose it to new location
//                 y: format.y + y_offset,
//               });
//           });

//           // border data
//           json.data.borders.forEach((border: Border) => {
//             // transpose borders
//             // combine with existing borders
//             const existingBorder = sheet_controller.sheet.borders.get(border.x + x_offset, border.y + y_offset);
//             borders_to_update.push({
//               ...existingBorder,
//               ...border, // take old border
//               x: border.x + x_offset, // transpose it to new location
//               y: border.y + y_offset,
//             });
//           });

//           // Start Transaction
//           sheet_controller.start_transaction();

//           // TODO: delete cells that will be overwritten
//           // TODO: delete formats that will be overwritten
//           // TODO: delete borders that will be overwritten

//           // update cells
//           await updateCellAndDCells({
//             starting_cells: cells_to_update,
//             sheetController: sheet_controller,
//             create_transaction: false,
//           });

//           // update formats
//           sheet_controller.execute_statement({
//             type: 'SET_CELL_FORMATS',
//             data: formats_to_update,
//           });

//           // update borders
//           if (borders_to_update.length) {
//             sheet_controller.execute_statement({
//               type: 'SET_BORDERS',
//               data: borders_to_update,
//             });
//           }

//           sheet_controller.end_transaction();

//           return true; // successful don't continue
//         }

//         return false; // unsuccessful
//       } else if (item.types.includes('text/plain')) {
//         const text_blob = await item.getType('text/plain');
//         let item_text = await text_blob.text();
//         return pasteFromText(sheet_controller, pasteToCell, item_text);
//       }
//     }
//     return false; // unsuccessful
//   } catch (e) {
//     console.warn(e);
//     return false; // unsuccessful
//   }
// };

// const pasteFromText = async (sheet_controller: SheetController, pasteToCell: Coordinate, clipboard_text: string) => {
//   try {
//     let cell_x: number = pasteToCell.x;
//     let cell_y: number = pasteToCell.y;

//     // build api payload
//     let cells_to_write: Cell[] = [];
//     let cells_to_delete: Coordinate[] = [];

//     let str_rows: string[] = clipboard_text.split('\n');

//     // for each copied row
//     str_rows.forEach((str_row) => {
//       let str_cells: string[] = str_row.split('\t');

//       // for each copied cell
//       str_cells.forEach((str_cell) => {
//         // update or clear cell
//         if (str_cell !== '') {
//           cells_to_write.push({
//             x: cell_x,
//             y: cell_y,
//             type: 'TEXT',
//             value: str_cell,
//             last_modified: new Date().toISOString(),
//           });
//         } else {
//           cells_to_delete.push({
//             x: cell_x,
//             y: cell_y,
//           });
//         }

//         // move to next cell
//         cell_x += 1;
//       });

//       // move to next row and return
//       cell_y += 1;
//       cell_x = pasteToCell.x;
//     });

//     // TODO ALSO BE ABLE TO PASS CELLS TO DELETE TO updatecellandcells

//     // bulk update and delete cells
//     await updateCellAndDCells({
//       starting_cells: cells_to_write,
//       sheetController: sheet_controller,
//     });

//     // cells_to_delete

//     return true; // unsuccessful
//   } catch (e) {
//     console.warn(e);
//     return false; // unsuccessful
//   }
// };

// copies plainText and html to the clipboard
const toClipboard = (plainText: string, html: string) => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  if (navigator.clipboard && window.ClipboardItem) {
    // browser support clipboard api navigator.clipboard
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  } else {
    // fallback to textarea
    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

export const copyToClipboard = (sheetController: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  const { plainText, html } = sheetController.grid.copyToClipboard(
    sheetController.sheet.id,
    new Rectangle(cell0.x, cell0.y, cell1.x - cell0.x, cell1.y - cell0.y)
  );
  toClipboard(plainText, html);
};

export const cutToClipboard = async (sheetController: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  const { summary, plainText, html } = sheetController.grid.cutToClipboard(
    sheetController.sheet.id,
    new Rectangle(cell0.x, cell0.y, cell1.x - cell0.x, cell1.y - cell0.y),
    sheetController.sheet.cursor.save()
  );
  toClipboard(plainText, html);
  if (!summary) throw new Error('Expected summary to be defined in cutToClipboard');
  transactionResponse(sheetController, summary);
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

export const pasteFromClipboard = async (sheetController: SheetController, target: Coordinate) => {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const clipboardData = await navigator.clipboard.read();
      const plainTextItem = clipboardData.find((item) => item.types.includes('text/plain'));
      let plainText: string | undefined;
      if (plainTextItem) {
        const item = await plainTextItem.getType('text/plain');
        plainText = await item.text();
      }
      let html: string | undefined;
      const htmlItem = clipboardData.find((item) => item.types.includes('text/html'));
      if (htmlItem) {
        const item = await htmlItem.getType('text/html');
        html = await item.text();
      }
      const summary = sheetController.grid.pasteFromClipboard({
        sheetId: sheetController.sheet.id,
        x: target.x,
        y: target.y,
        plainText,
        html,
        cursor: sheetController.sheet.cursor.save(),
      });
      transactionResponse(sheetController, summary);
    } catch (e) {
      console.warn(e);
    }
  }
};
