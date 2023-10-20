import * as Sentry from '@sentry/browser';
import { Point, Rectangle } from 'pixi.js';
import { debugMockLargeData } from '../../debugFlags';
import { debugTimeCheck, debugTimeReset } from '../../gridGL/helpers/debugPerformance';
import { Coordinate } from '../../gridGL/types/size';
import { readFileAsArrayBuffer } from '../../helpers/files';
import init, {
  CodeCellLanguage,
  GridController,
  JsRenderCodeCell,
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
  FormattingSummary,
  JsClipboard,
  JsRenderCell,
  JsRenderFill,
  Rect,
} from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { sheets } from './Sheets';
import { transactionResponse } from './transactionResponse';

const rectangleToRect = (rectangle: Rectangle): RectInternal => {
  return new RectInternal(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

export const pointsToRect = (x: number, y: number, width: number, height: number): RectInternal => {
  return new RectInternal(new Pos(x, y), new Pos(x + width, y + height));
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
  grid: GridFile
): Promise<{
  contents: string;
  version: string;
} | null> => {
  await init();
  try {
    const gc = GridController.newFromFile(JSON.stringify(grid));
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
  private _dirty = false;

  get dirty(): boolean {
    // the sheet is never dirty when mocking large data (to stop it from saving over an actual file)
    return debugMockLargeData ? false : this._dirty;
  }
  set dirty(value: boolean) {
    this._dirty = value;
  }

  // this cannot be called in the constructor as Rust is not yet loaded
  init() {
    this.gridController = new GridController();
  }

  // import/export
  openFromContents(contents: string): boolean {
    try {
      this.gridController = GridController.newFromFile(contents);
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }

  populateWithRandomFloats(sheetId: string, width: number, height: number) {
    this.gridController.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height));
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

  async addSheet() {
    const summary = await this.gridController.addSheet(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async deleteSheet(sheetId: string) {
    const summary = await this.gridController.deleteSheet(sheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async setSheetName(sheetId: string, name: string) {
    const summary = await this.gridController.setSheetName(sheetId, name, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async setSheetColor(sheetId: string, color: string | undefined) {
    const summary = await this.gridController.setSheetColor(sheetId, color, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async duplicateSheet(sheetId: string) {
    const summary = await this.gridController.duplicateSheet(sheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async moveSheet(sheetId: string, leftSheetId: string | undefined) {
    const summary = await this.gridController.moveSheet(sheetId, leftSheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region set grid operations
  //-----------------------------

  async setCellValue(options: { sheetId: string; x: number; y: number; value: string }) {
    const summary = await this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      options.value,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCodeCellValue(options: {
    sheetId: string;
    x: number;
    y: number;
    language: CodeCellLanguage;
    codeString: string;
  }) {
    const summary = await this.gridController.setCellCode(
      options.sheetId,
      new Pos(options.x, options.y),
      options.language,
      options.codeString,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async deleteCellValues(sheetId: string, rectangle: Rectangle) {
    const summary = await this.gridController.deleteCellValues(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellAlign(sheetId: string, rectangle: Rectangle, align: CellAlign | undefined) {
    const summary = await this.gridController.setCellAlign(
      sheetId,
      rectangleToRect(rectangle),
      align,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellWrap(sheetId: string, rectangle: Rectangle, wrap: CellWrap) {
    const summary = await this.gridController.setCellWrap(
      sheetId,
      rectangleToRect(rectangle),
      wrap,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellCurrency(sheetId: string, rectangle: Rectangle, symbol: string) {
    const summary = await this.gridController.setCellCurrency(
      sheetId,
      rectangleToRect(rectangle),
      symbol,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellPercentage(sheetId: string, rectangle: Rectangle) {
    const summary = await this.gridController.setCellPercentage(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async removeCellNumericFormat(sheetId: string, rectangle: Rectangle) {
    const summary = await this.gridController.removeCellNumericFormat(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean) {
    const summary = await this.gridController.setCellBold(
      sheetId,
      rectangleToRect(rectangle),
      bold,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean) {
    const summary = await this.gridController.setCellItalic(
      sheetId,
      rectangleToRect(rectangle),
      italic,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellTextColor(sheetId: string, rectangle: Rectangle, textColor: string | undefined) {
    const summary = await this.gridController.setCellTextColor(
      sheetId,
      rectangleToRect(rectangle),
      textColor,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async setCellFillColor(sheetId: string, rectangle: Rectangle, fillColor: string | undefined) {
    const summary = await this.gridController.setCellFillColor(
      sheetId,
      rectangleToRect(rectangle),
      fillColor,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async changeDecimalPlaces(sheetId: string, source: Pos, rectangle: Rectangle, delta: number) {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const summary = await this.gridController.changeDecimalPlaces(
      sheetId,
      source,
      rectangleToRect(rectangle),
      delta,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  async clearFormatting(sheetId: string, rectangle: Rectangle) {
    const summary = await this.gridController.clearFormatting(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region get grid information
  // ---------------------------

  getEditCell(sheetId: string, pos: Pos): string {
    return this.gridController.getEditCell(sheetId, pos);
  }

  cellHasContent(sheetId: string, column: number, row: number): boolean {
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(new Rectangle(column, row, 0, 0)));
    const results = JSON.parse(data);
    return results.length ? !!results[0].value : false;
  }

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    const data = this.gridController.getRenderFills(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getAllRenderFills(sheetId: string): JsRenderFill[] {
    const data = this.gridController.getAllRenderFills(sheetId);
    return JSON.parse(data);
  }

  // todo: fix types
  getCodeValue(sheetId: string, x: number, y: number): any | undefined {
    return this.gridController.getCodeCellValue(sheetId, new Pos(x, y));
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

  async undo() {
    const summary = await this.gridController.undo(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async redo() {
    const summary = await this.gridController.redo(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region Clipboard

  copyToClipboard(sheetId: string, rectangle: Rectangle): JsClipboard {
    return this.gridController.copyToClipboard(sheetId, rectangleToRect(rectangle));
  }

  async cutToClipboard(sheetId: string, rectangle: Rectangle): Promise<{ html: string; plainText: string }> {
    const { summary, html, plainText } = await this.gridController.cutToClipboard(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
    return { html, plainText };
  }

  async pasteFromClipboard(options: {
    sheetId: string;
    x: number;
    y: number;
    plainText: string | undefined;
    html: string | undefined;
  }) {
    const { sheetId, x, y, plainText, html } = options;
    const summary = await this.gridController.pasteFromClipboard(
      sheetId,
      new Pos(x, y),
      plainText,
      html,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region Imports

  async importCsv(sheetId: string, file: File, insertAtCellLocation: Coordinate, reportError: (error: string) => void) {
    debugTimeReset();
    const pos = new Pos(insertAtCellLocation.x, insertAtCellLocation.y);
    const file_bytes = await readFileAsArrayBuffer(file);

    try {
      const summary = await this.gridController.importCsv(
        sheetId,
        file_bytes,
        file.name,
        pos,
        sheets.getCursorPosition()
      );
      transactionResponse(summary);
    } catch (error) {
      // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
      // type in the UI.
      reportError(error as unknown as string);
      Sentry.captureException(error);
    }
    debugTimeCheck(`uploading and processing csv file ${file.name}`);
  }

  //#endregion

  //#region column/row sizes

  async commitTransientResize(sheetId: string, transientResize: TransientResize) {
    const summary = await this.gridController.commitOffsetsResize(sheetId, transientResize, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  async commitSingleResize(sheetId: string, column: number | undefined, row: number | undefined, size: number) {
    const summary = await this.gridController.commitSingleResize(
      sheetId,
      column,
      row,
      size,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  getOffsets(sheetId: string): SheetOffsets {
    return this.gridController.getOffsets(sheetId);
  }

  //#endregion

  //#region AutoComplete
  //-----------------

  async expand(sheetId: string, rectangle: Rectangle, range: Rectangle) {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');

    const summary = await this.gridController.expand(
      sheetId,
      rectangleToRect(rectangle),
      rectangleToRect(range),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion
}

//#end

export const grid = new Grid();
