import { htmlCellsHandler } from '@/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { multiplayer } from '@/multiplayer/multiplayer';
import * as Sentry from '@sentry/react';
import { Point, Rectangle } from 'pixi.js';
import { debugDisableProxy, debugShowMultiplayer } from '../../debugFlags';
import { debugTimeCheck, debugTimeReset } from '../../gridGL/helpers/debugPerformance';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { readFileAsArrayBuffer } from '../../helpers/files';
import init, {
  BorderSelection,
  BorderStyle,
  GridController,
  JsCodeResult,
  JsComputeGetCells,
  JsRenderBorders,
  MinMax,
  Pos,
  Rect as RectInternal,
  SheetOffsets,
  TransientResize,
} from '../../quadratic-core/quadratic_core';
import {
  CellAlign,
  CellFormatSummary,
  CellWrap,
  CodeCellLanguage,
  FormattingSummary,
  JsClipboard,
  JsCodeCell,
  JsHtmlOutput,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  Rect,
  TransactionSummary,
} from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { SheetCursorSave } from '../sheet/SheetCursor';
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

  transactionResponse(summary: TransactionSummary) {
    if (summary.sheet_list_modified) {
      sheets.repopulate();
    }

    if (summary.cell_sheets_modified.length) {
      pixiApp.cellsSheets.modified(summary.cell_sheets_modified);
    }

    if (summary.fill_sheets_modified.length) {
      pixiApp.cellsSheets.updateFills(summary.fill_sheets_modified);
    }

    if (summary.offsets_modified.length) {
      sheets.updateOffsets(summary.offsets_modified);
      pixiApp.cellsSheets.updateBorders(summary.offsets_modified);
      htmlCellsHandler.updateOffsets(summary.offsets_modified.map((offset) => offset.id));
      pixiApp.cursor.dirty = true;
      pixiApp.multiplayerCursor.dirty = true;
    }

    if (summary.code_cells_modified.length) {
      pixiApp.cellsSheets.updateCodeCells(summary.code_cells_modified);
      window.dispatchEvent(new CustomEvent('code-cells-update'));
    }

    if (summary.border_sheets_modified.length) {
      pixiApp.cellsSheets.updateBorders(summary.border_sheets_modified);
    }

    if (summary.generate_thumbnail) {
      this.thumbnailDirty = true;
    }

    if (summary.html) {
      window.dispatchEvent(new CustomEvent('html-update', { detail: summary.html }));
    }

    const cursor = summary.cursor ? (JSON.parse(summary.cursor) as SheetCursorSave) : undefined;
    if (cursor) {
      sheets.current = cursor.sheetId;
      sheets.sheet.cursor.load(cursor);
    }
    if (summary.save) {
      window.dispatchEvent(new CustomEvent('transaction-complete'));
    }

    // multiplayer transactions
    if (summary.operations) {
      multiplayer.sendTransaction(summary.transaction_id!, summary.operations);
    }

    if (summary.request_transactions) {
      multiplayer.sendGetTransactions(summary.request_transactions);
    }

    // todo: this should not be necessary as Update.ts should take care of it; right now
    //       it renders every time it receives a heartbeat. not a big deal but worth fixing.
    pixiApp.setViewportDirty();
  }

  test() {
    this.gridController = GridController.test();
  }

  // import/export
  openFromContents(contents: string, lastSequenceNum: number): boolean {
    try {
      this.gridController = GridController.newFromFile(contents, lastSequenceNum);
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }

  export(): string {
    return this.gridController.exportToFile();
  }

  getVersion(): string {
    return this.gridController.getVersion();
  }

  //#region get sheet information
  //-------------------------

  sheetIndexToId(index: number): string | undefined {
    return this.gridController.sheetIndexToId(index);
  }

  getSheetOrder(sheetId: string): string {
    return this.gridController.getSheetOrder(sheetId);
  }

  getSheetName(sheetId: string): string | undefined {
    return this.gridController.getSheetName(sheetId);
  }

  getSheetColor(sheetId: string): string | undefined {
    return this.gridController.getSheetColor(sheetId);
  }

  //#endregion

  //#region set sheet operations
  //------------------------

  getSheetIds(): string[] {
    const data = this.gridController.getSheetIds();
    return JSON.parse(data);
  }

  addSheet() {
    const summary = this.gridController.addSheet(sheets.getCursorPosition());
    this.transactionResponse(summary);
  }

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

  setCellValue(options: { sheetId: string; x: number; y: number; value: string }) {
    const summary = this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      options.value,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  // returns whether the transaction completed
  setCodeCellValue(options: {
    sheetId: string;
    x: number;
    y: number;
    language: CodeCellLanguage;
    codeString: string;
  }): boolean {
    const summary = this.gridController.setCellCode(
      options.sheetId,
      new Pos(options.x, options.y),
      options.language,
      options.codeString,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
    return summary.complete;
  }

  deleteCellValues(sheetId: string, rectangle: Rectangle) {
    const summary = this.gridController.deleteCellValues(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellAlign(sheetId: string, rectangle: Rectangle, align: CellAlign | undefined) {
    const summary = this.gridController.setCellAlign(
      sheetId,
      rectangleToRect(rectangle),
      align,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellWrap(sheetId: string, rectangle: Rectangle, wrap: CellWrap) {
    const summary = this.gridController.setCellWrap(
      sheetId,
      rectangleToRect(rectangle),
      wrap,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellCurrency(sheetId: string, rectangle: Rectangle, symbol: string) {
    const summary = this.gridController.setCellCurrency(
      sheetId,
      rectangleToRect(rectangle),
      symbol,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellPercentage(sheetId: string, rectangle: Rectangle) {
    const summary = this.gridController.setCellPercentage(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellExponential(sheetId: string, rectangle: Rectangle) {
    const summary = this.gridController.setCellExponential(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  toggleCommas(sheetId: string, source: Pos, rectangle: Rectangle) {
    const summary = this.gridController.toggleCommas(
      sheetId,
      source,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  removeCellNumericFormat(sheetId: string, rectangle: Rectangle) {
    const summary = this.gridController.removeCellNumericFormat(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean) {
    const summary = this.gridController.setCellBold(
      sheetId,
      rectangleToRect(rectangle),
      bold,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean) {
    const summary = this.gridController.setCellItalic(
      sheetId,
      rectangleToRect(rectangle),
      italic,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellTextColor(sheetId: string, rectangle: Rectangle, textColor: string | undefined) {
    const summary = this.gridController.setCellTextColor(
      sheetId,
      rectangleToRect(rectangle),
      textColor,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  setCellFillColor(sheetId: string, rectangle: Rectangle, fillColor: string | undefined) {
    const summary = this.gridController.setCellFillColor(
      sheetId,
      rectangleToRect(rectangle),
      fillColor,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  changeDecimalPlaces(sheetId: string, source: Pos, rectangle: Rectangle, delta: number) {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const summary = this.gridController.changeDecimalPlaces(
      sheetId,
      source,
      rectangleToRect(rectangle),
      delta,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  clearFormatting(sheetId: string, rectangle: Rectangle) {
    const summary = this.gridController.clearFormatting(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

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

  getEditCell(sheetId: string, pos: Pos): string {
    return this.gridController.getEditCell(sheetId, pos);
  }

  cellHasContent(sheetId: string, column: number, row: number): boolean {
    return this.gridController.hasRenderCells(sheetId, posToRect(column, row));
  }

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  hasRenderCells(sheetId: string, rectangle: Rectangle): boolean {
    return this.gridController.hasRenderCells(sheetId, rectangleToRect(rectangle));
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    const data = this.gridController.getRenderFills(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getAllRenderFills(sheetId: string): JsRenderFill[] {
    const data = this.gridController.getAllRenderFills(sheetId);
    return JSON.parse(data);
  }

  getCodeCell(sheetId: string, x: number, y: number): JsCodeCell | undefined {
    return this.gridController.getCodeCell(sheetId, new Pos(x, y));
  }

  getRenderCodeCells(sheetId: string): JsRenderCodeCell[] {
    const data = this.gridController.getAllRenderCodeCells(sheetId);
    return JSON.parse(data);
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): CellFormatSummary {
    return this.gridController.getCellFormatSummary(sheetId, new Pos(x, y));
  }

  getFormattingSummary(sheetId: string, rectangle: Rectangle): FormattingSummary {
    return this.gridController.getFormattingSummary(sheetId, rectangleToRect(rectangle) as RectInternal);
  }

  getRenderBorders(sheetId: string): JsRenderBorders {
    return this.gridController.getRenderBorders(sheetId);
  }

  getHtmlOutput(sheetId: string): JsHtmlOutput[] {
    const data = this.gridController.getHtmlOutput(sheetId);
    return JSON.parse(data);
  }

  //#endregion

  //#region Bounds

  getGridBounds(sheetId: string, ignoreFormatting: boolean): Rectangle | undefined {
    const bounds = this.gridController.getGridBounds(sheetId, ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return new Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  }

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

  hasUndo(): boolean {
    return this.gridController.hasUndo();
  }

  hasRedo(): boolean {
    return this.gridController.hasRedo();
  }

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
  }) {
    const { sheetId, x, y, plainText, html } = options;
    const summary = this.gridController.pasteFromClipboard(
      sheetId,
      new Pos(x, y),
      plainText,
      html,
      sheets.getCursorPosition()
    );
    this.transactionResponse(summary);
  }

  //#endregion

  //#region Imports

  async importCsv(sheetId: string, file: File, insertAtCellLocation: Coordinate, reportError: (error: string) => void) {
    debugTimeReset();
    const pos = new Pos(insertAtCellLocation.x, insertAtCellLocation.y);
    const file_bytes = await readFileAsArrayBuffer(file);

    try {
      const summary = this.gridController.importCsv(sheetId, file_bytes, file.name, pos, sheets.getCursorPosition());
      this.transactionResponse(summary);
    } catch (error) {
      // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
      // type in the UI.
      reportError(error as unknown as string);
      Sentry.captureException(error);
    }
    debugTimeCheck(`uploading and processing csv file ${file.name}`);
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
    const summaryResult = this.gridController.calculationComplete(result);
    if (summaryResult.Ok) {
      this.transactionResponse(summaryResult.Ok);
    } else {
      throw new Error(summaryResult.Err);
    }
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

  //#endregion

  //#region Summarize
  //-----------------

  summarizeSelection(decimal_places: number = 9) {
    return this.gridController.summarizeSelection(
      sheets.sheet.id,
      rectangleToRect(sheets.sheet.cursor.getRectangle()),
      BigInt(decimal_places)
    );
  }

  //#endregion

  //#region Multiplayer
  //-----------------

  multiplayerTransaction(transactionId: string, sequenceNum: number, operations: string) {
    const summary = this.gridController.multiplayerTransaction(transactionId, sequenceNum, operations);
    this.transactionResponse(summary);
  }

  setMultiplayerSequenceNum(sequenceNum: number) {
    this.gridController.setMultiplayerSequenceNum(sequenceNum);
  }

  receiveSequenceNum(sequenceNum: number) {
    if (debugShowMultiplayer) console.log(`[Multiplayer] Server is at sequence_num ${sequenceNum}.`);
    const summary = this.gridController.receiveSequenceNum(sequenceNum);
    this.transactionResponse(summary);
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
}

//#end

let gridCreate: Grid;

if (debugDisableProxy) {
  gridCreate = new Grid();
} else {
  gridCreate = GridPerformanceProxy(new Grid());
}

export const grid = gridCreate;
