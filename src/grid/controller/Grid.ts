import * as Sentry from '@sentry/browser';
import { Point, Rectangle } from 'pixi.js';
import { debugMockLargeData } from '../../debugFlags';
import { Coordinate } from '../../gridGL/types/size';
import { GridController, Pos, Rect as RectInternal } from '../../quadratic-core/quadratic_core';
import {
  CellAlign,
  CellFormatSummary,
  CellWrap,
  // CodeCellValue,
  FormattingSummary,
  JsClipboard,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  Rect,
} from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { sheets } from './Sheets';
import { transactionResponse } from './transactionResponse';

const rectangleToRect = (rectangle: Rectangle): RectInternal => {
  return new RectInternal(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

const pointsToRect = (x: number, y: number, width: number, height: number): RectInternal => {
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

  newFromFile(grid: GridFile): boolean {
    try {
      this.gridController = GridController.newFromFile(JSON.stringify(grid));
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }

  populateWithRandomFloats(sheetId: string, width: number, height: number): void {
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

  addSheet(): void {
    const summary = this.gridController.addSheet(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  deleteSheet(sheetId: string): void {
    const summary = this.gridController.deleteSheet(sheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  setSheetName(sheetId: string, name: string): void {
    const summary = this.gridController.setSheetName(sheetId, name, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  setSheetColor(sheetId: string, color: string | undefined): void {
    const summary = this.gridController.setSheetColor(sheetId, color, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  duplicateSheet(sheetId: string): void {
    const summary = this.gridController.duplicateSheet(sheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  moveSheet(sheetId: string, leftSheetId: string | undefined): void {
    const summary = this.gridController.moveSheet(sheetId, leftSheetId, sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region set grid operations
  //-----------------------------

  setCellValue(options: { sheetId: string; x: number; y: number; value: string }): void {
    const summary = this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      options.value,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  // todo....
  setCodeCellValue(options: { sheetId: string; x: number; y: number; codeString: string }): void {
    // const summary = this.gridController.set;
    throw new Error('not implemented yet...');
    // transactionResponse(summary);
    // this.dirty = true;
  }

  deleteCellValues(sheetId: string, rectangle: Rectangle): void {
    const summary = this.gridController.deleteCellValues(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellAlign(sheetId: string, rectangle: Rectangle, align: CellAlign | undefined): void {
    const summary = this.gridController.setCellAlign(
      sheetId,
      rectangleToRect(rectangle),
      align,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellWrap(sheetId: string, rectangle: Rectangle, wrap: CellWrap): void {
    const summary = this.gridController.setCellWrap(
      sheetId,
      rectangleToRect(rectangle),
      wrap,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellCurrency(sheetId: string, rectangle: Rectangle, symbol: string): void {
    const summary = this.gridController.setCellCurrency(
      sheetId,
      rectangleToRect(rectangle),
      symbol,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellPercentage(sheetId: string, rectangle: Rectangle): void {
    const summary = this.gridController.setCellPercentage(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  removeCellNumericFormat(sheetId: string, rectangle: Rectangle): void {
    const summary = this.gridController.removeCellNumericFormat(
      sheetId,
      rectangleToRect(rectangle),
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean): void {
    const summary = this.gridController.setCellBold(
      sheetId,
      rectangleToRect(rectangle),
      bold,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean): void {
    const summary = this.gridController.setCellItalic(
      sheetId,
      rectangleToRect(rectangle),
      italic,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellTextColor(sheetId: string, rectangle: Rectangle, textColor: string | undefined): void {
    const summary = this.gridController.setCellTextColor(
      sheetId,
      rectangleToRect(rectangle),
      textColor,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellFillColor(sheetId: string, rectangle: Rectangle, fillColor: string | undefined): void {
    const summary = this.gridController.setCellFillColor(
      sheetId,
      rectangleToRect(rectangle),
      fillColor,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  changeDecimalPlaces(sheetId: string, source: Pos, rectangle: Rectangle, delta: number): void {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const summary = this.gridController.changeDecimalPlaces(
      sheetId,
      source,
      rectangleToRect(rectangle),
      delta,
      sheets.getCursorPosition()
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  clearFormatting(sheetId: string, rectangle: Rectangle): void {
    const summary = this.gridController.clearFormatting(
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

  getGridBounds(sheetId: string, ignoreFormatting: boolean): Rectangle | undefined {
    const bounds = this.gridController.getGridBounds(sheetId, ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return new Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
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

  //#region Undo/redo
  //-----------------

  hasUndo(): boolean {
    return this.gridController.hasUndo();
  }

  hasRedo(): boolean {
    return this.gridController.hasRedo();
  }

  undo(): void {
    const summary = this.gridController.undo(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
  }

  redo(): void {
    const summary = this.gridController.redo(sheets.getCursorPosition());
    transactionResponse(summary);
    this.dirty = true;
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
    transactionResponse(summary);
    this.dirty = true;
    return { html, plainText };
  }

  pasteFromClipboard(options: {
    sheetId: string;
    x: number;
    y: number;
    plainText: string | undefined;
    html: string | undefined;
  }): void {
    const { sheetId, x, y, plainText, html } = options;
    const summary = this.gridController.pasteFromClipboard(
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
    const pos = new Pos(insertAtCellLocation.x, insertAtCellLocation.y);
    const text = await file.text();

    try {
      const summary = this.gridController.importCsv(sheetId, text, file.name, pos, sheets.getCursorPosition());
      transactionResponse(summary);
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}

//#end

export const grid = new Grid();
