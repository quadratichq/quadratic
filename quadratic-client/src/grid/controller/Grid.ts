import { JsClipboard, JsHtmlOutput, Rect, SearchOptions, SheetPos } from '@/quadratic-core-types';
import init, {
  BorderSelection,
  BorderStyle,
  GridController,
  JsCodeResult,
  JsComputeGetCells,
  MinMax,
  PasteSpecial,
  Pos,
  Rect as RectInternal,
  SheetOffsets,
  TransientResize,
} from '@/quadratic-core/quadratic_core';
import { Point, Rectangle } from 'pixi.js';
import { debugDisableProxy, debugShowMultiplayer } from '../../debugFlags';
import { debugTimeCheck, debugTimeReset } from '../../gridGL/helpers/debugPerformance';
import { GridFile } from '../../schemas';
import { GridPerformanceProxy } from './GridPerformanceProxy';
import { sheets } from './Sheets';

const rectangleToRect = (rectangle: Rectangle): RectInternal => {
  return new RectInternal(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

export const pointsToRect = (x: number, y: number, width: number, height: number): RectInternal => {
  return new RectInternal(new Pos(x, y), new Pos(x + width, y + height));
};

export const posToRect = (x: number, y: number): RectInternal => {
  return new RectInternal(new Pos(x, y), new Pos(x, y));
};

export const rectToRectangle = (rect: Rect): Rectangle => {
  return new Rectangle(
    Number(rect.min.x),
    Number(rect.min.y),
    Number(rect.max.x - rect.min.x),
    Number(rect.max.y - rect.min.y)
  );
};

export const rectToPoint = (rect: Rect): Point => {
  if (rect.min.x !== rect.max.x || rect.min.y !== rect.max.x) {
    throw new Error('Expected rectToPoint to receive a rectangle with width/height = 1');
  }
  return new Point(Number(rect.min.x), Number(rect.min.y));
};

export const upgradeFileRust = async (
  grid: GridFile,
  lastSequenceNum: number
): Promise<{
  contents: string;
  version: string;
} | null> => {
  await init();
  try {
    const gc = GridController.newFromFile(JSON.stringify(grid), lastSequenceNum);
    const contents = gc.exportToFile();
    return { contents: contents, version: gc.getVersion() };
  } catch (e) {
    console.warn(e);
    return null;
  }
};

// TS wrapper around Grid.rs
export class Grid {
  private gridController!: GridController;
  thumbnailDirty = false;

  transactionResponse(summary: undefined) {
    // if (summary.sheet_list_modified) {
    //   sheets.repopulate();
    // }
    // if (summary.fill_sheets_modified.length) {
    //   // pixiApp.cellsSheets.updateFills(summary.fill_sheets_modified);
    // }
    // if (summary.offsets_modified.length) {
    //   sheets.updateOffsets(summary.offsets_modified);
    //   pixiApp.cellsSheets.updateBorders(summary.offsets_modified);
    //   htmlCellsHandler.updateOffsets(summary.offsets_modified.map((offset) => offset.id));
    //   pixiApp.cursor.dirty = true;
    //   pixiApp.multiplayerCursor.dirty = true;
    // }
    // if (summary.code_cells_modified.length) {
    //   pixiApp.cellsSheets.updateCodeCells(summary.code_cells_modified);
    //   window.dispatchEvent(new CustomEvent('code-cells-update'));
    // }
    // if (summary.border_sheets_modified.length) {
    //   pixiApp.cellsSheets.updateBorders(summary.border_sheets_modified);
    // }
    // if (summary.generate_thumbnail) {
    //   this.thumbnailDirty = true;
    // }
    // if (summary.html) {
    //   window.dispatchEvent(new CustomEvent('html-update', { detail: summary.html }));
    // }
    // const cursor = summary.cursor ? (JSON.parse(summary.cursor) as SheetCursorSave) : undefined;
    // if (cursor) {
    //   sheets.current = cursor.sheetId;
    //   sheets.sheet.cursor.load(cursor);
    // }
    // if (summary.save) {
    //   window.dispatchEvent(new CustomEvent('transaction-complete'));
    // }
    // // multiplayer transactions
    // if (summary.operations) {
    //   // multiplayer.sendTransaction(summary.transaction_id!, summary.operations);
    // }
    // if (summary.request_transactions) {
    //   multiplayer.sendGetTransactions(summary.request_transactions);
    // }
    // // todo: this should not be necessary as Update.ts should take care of it; right now
    // //       it renders every time it receives a heartbeat. not a big deal but worth fixing.
    // pixiApp.setViewportDirty();
  }

  test() {
    this.gridController = GridController.test();
  }

  export(): string {
    return this.gridController.exportToFile();
  }

  getVersion(): string {
    return this.gridController.getVersion();
  }

  //#region get sheet information
  //-------------------------

  // getSheetOrder(sheetId: string): string {
  //   return this.gridController.getSheetOrder(sheetId);
  // }

  // getSheetName(sheetId: string): string | undefined {
  //   return this.gridController.getSheetName(sheetId);
  // }

  // getSheetColor(sheetId: string): string | undefined {
  //   return this.gridController.getSheetColor(sheetId);
  // }

  //#endregion

  //#region set sheet operations
  //------------------------

  // addSheet() {
  //   const summary = this.gridController.addSheet(sheets.getCursorPosition());
  //   this.transactionResponse(summary);
  // }

  deleteSheet(sheetId: string) {
    const summary = this.gridController.deleteSheet(sheetId, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  setSheetName(sheetId: string, name: string) {
    const summary = this.gridController.setSheetName(sheetId, name, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  setSheetColor(sheetId: string, color: string | undefined) {
    const summary = this.gridController.setSheetColor(sheetId, color, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  duplicateSheet(sheetId: string) {
    const summary = this.gridController.duplicateSheet(sheetId, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  moveSheet(sheetId: string, leftSheetId: string | undefined) {
    const summary = this.gridController.moveSheet(sheetId, leftSheetId, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  //#endregion

  //#region set grid operations
  //-----------------------------

  setRegionBorders(sheetId: string, rectangle: Rectangle, selection: BorderSelection, style?: BorderStyle) {
    const summary = this.gridController.setRegionBorders(
      sheetId,
      rectangleToRect(rectangle),
      selection,
      style,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellRenderSize(sheetId: string, x: number, y: number, width: number, height: number) {
    const summary = this.gridController.setCellRenderSize(
      sheetId,
      posToRect(x, y),
      width.toString(),
      height.toString()
    );
    this.transactionResponse(summary);
  }

  //#endregion

  //#region get grid information
  // ---------------------------

  // todo...
  getHtmlOutput(sheetId: string): JsHtmlOutput[] {
    // const data = this.gridController.getHtmlOutput(sheetId);
    // return JSON.parse(data);
    return [];
  }

  //#endregion

  //#region Bounds

  getColumnBounds(sheetId: string, column: number, ignoreFormatting: boolean): MinMax | undefined {
    return this.gridController.getColumnBounds(sheetId, column, ignoreFormatting);
  }

  getColumnsBounds(
    sheetId: string,
    columnStart: number,
    columnEnd: number,
    ignoreFormatting: boolean
  ): MinMax | undefined {
    return this.gridController.getColumnsBounds(sheetId, columnStart, columnEnd, ignoreFormatting);
  }

  getRowBounds(sheetId: string, row: number, ignoreFormatting: boolean): MinMax | undefined {
    return this.gridController.getRowBounds(sheetId, row, ignoreFormatting);
  }

  getRowsBounds(sheetId: string, row_start: number, row_end: number, ignoreFormatting: boolean): MinMax | undefined {
    return this.gridController.getRowsBounds(sheetId, row_start, row_end, ignoreFormatting);
  }

  findNextColumn(options: {
    sheetId: string;
    columnStart: number;
    row: number;
    reverse: boolean;
    withContent: boolean;
  }): number {
    return this.gridController.findNextColumn(
      options.sheetId,
      options.columnStart,
      options.row,
      options.reverse,
      options.withContent
    );
  }

  findNextRow(options: {
    sheetId: string;
    rowStart: number;
    column: number;
    reverse: boolean;
    withContent: boolean;
  }): number {
    return this.gridController.findNextRow(
      options.sheetId,
      options.rowStart,
      options.column,
      options.reverse,
      options.withContent
    );
  }

  //#endregion

  //#region Undo/redo
  //-----------------
  undo() {
    const summary = this.gridController.undo(sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  redo() {
    const summary = this.gridController.redo(sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  //#endregion

  //#region Clipboard

  copyToClipboard(sheetId: string, rectangle: Rectangle): JsClipboard {
    return this.gridController.copyToClipboard(sheetId, rectangleToRect(rectangle));
  }

  cutToClipboard(sheetId: string, rectangle: Rectangle): { html: string; plainText: string } {
    const { summary, html, plainText } = this.gridController.cutToClipboard(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);

    return { html, plainText };
  }

  pasteFromClipboard(options: {
    sheetId: string;
    x: number;
    y: number;
    plainText: string | undefined;
    html: string | undefined;
    special: PasteSpecial;
  }) {
    const { sheetId, x, y, plainText, html, special } = options;
    const summary = this.gridController.pasteFromClipboard(
      sheetId,
      new Pos(x, y),
      plainText,
      html,
      special,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  //#endregion

  //#region Exports

  exportCsvSelection(): string {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');

    debugTimeReset();
    const csv = this.gridController.exportCsvSelection(
      sheets.sheet.id,
      rectangleToRect(sheets.sheet.cursor.getRectangle())
    );
    debugTimeCheck(`processing and exporting csv file`);

    return csv;
  }

  //#endregion

  //#region column/row sizes

  commitTransientResize(sheetId: string, transientResize: TransientResize) {
    const summary = this.gridController.commitOffsetsResize(sheetId, transientResize, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  commitSingleResize(sheetId: string, column: number | undefined, row: number | undefined, size: number) {
    const summary = this.gridController.commitSingleResize(sheetId, column, row, size, sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

  getOffsets(sheetId: string): SheetOffsets {
    return this.gridController.getOffsets(sheetId);
  }

  //#endregion

  //#region AutoComplete
  //-----------------

  autocomplete(sheetId: string, rectangle: Rectangle, range: Rectangle) {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');

    const summary = this.gridController.autocomplete(
      sheetId,
      rectangleToRect(rectangle),
      rectangleToRect(range),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  //#endregion

  //#region Compute

  calculationComplete(result: JsCodeResult) {
    // const summaryResult = this.gridController.calculationComplete(result);
    // if (summaryResult.Ok) {
    //   this.transactionResponse(summaryResult.Ok);
    // } else {
    //   throw new Error(summaryResult.Err);
    // }
  }

  // returns undefined if there was an error fetching cells (eg, invalid sheet name)
  calculationGetCells(
    transactionId: string,
    rect: RectInternal,
    sheetName: string | undefined,
    lineNumber: number | undefined
  ): { x: number; y: number; value: string }[] | undefined {
    const getCells = new JsComputeGetCells(
      transactionId,
      rect,
      sheetName,
      lineNumber === undefined ? undefined : BigInt(lineNumber)
    );
    const result = this.gridController.calculationGetCells(getCells);
    if (result.Err) {
      this.transactionResponse(result.Err);
    } else if (result.response) {
      return result.response;
    }
  }

  rerunAllCodeCells() {
    // const summary = this.gridController.rerunAllCodeCells(sheets.getCursorPosition());
    // this.transactionResponse(summary);
  }

  rerunSheetCodeCells() {
    // const sheetId = sheets.sheet.id;
    // const summary = this.gridController.rerunSheetCodeCells(sheetId, sheets.getCursorPosition());
    // this.transactionResponse(summary);
  }

  rerunCodeCell() {
    // const pos = sheets.sheet.cursor.getPos();
    // const summary = this.gridController.rerunCodeCell(sheets.sheet.id, pos, sheets.getCursorPosition());
    // this.transactionResponse(summary);
  }

  //#endregion

  //#region Multiplayer
  //-----------------

  setMultiplayerSequenceNum(sequenceNum: number) {
    this.gridController.setMultiplayerSequenceNum(sequenceNum);
  }

  // todo...
  receiveSequenceNum(sequenceNum: number) {
    // if (debugShowMultiplayer) console.log(`[Multiplayer] Server is at sequence_num ${sequenceNum}.`);
    // const summary = this.gridController.receiveSequenceNum(sequenceNum);
    // this.transactionResponse(summary);
  }

  receiveMultiplayerTransactions(transactions: string) {
    if (debugShowMultiplayer) console.log('[Multiplayer] Received catch-up transactions.');
    const summaryResponse = this.gridController.receiveMultiplayerTransactions(transactions);
    if (summaryResponse.Ok) {
      this.transactionResponse(summaryResponse.Ok);
    } else {
      console.error(summaryResponse.Err);
      throw new Error(summaryResponse.Err);
    }
  }

  applyOfflineUnsavedTransaction(transactionId: string, transaction: string) {
    if (debugShowMultiplayer) console.log('[Multiplayer] Applying an offline unsaved transaction.');
    const summaryResponse = this.gridController.applyOfflineUnsavedTransaction(transactionId, transaction);
    this.transactionResponse(summaryResponse);
  }

  //#endregion

  //#region Search
  search(text: string, options: SearchOptions): SheetPos[] {
    return this.gridController.search(text, options);
  }

  //#endregion
}

let gridCreate: Grid;

if (debugDisableProxy) {
  gridCreate = new Grid();
} else {
  gridCreate = GridPerformanceProxy(new Grid());
}

export const grid = gridCreate;
