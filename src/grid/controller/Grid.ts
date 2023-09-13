import { Point, Rectangle } from 'pixi.js';
import { GridController, Pos, Rect as RectInternal } from '../../quadratic-core/quadratic_core';
import {
  CellAlign,
  CellFormatSummary,
  CellWrap,
  // CodeCellValue,
  FormattingSummary,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  Rect,
} from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { SheetCursorSave } from '../sheet/SheetCursor';
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
  dirty = false;

  // import/export

  init() {
    this.gridController = new GridController();
  }

  newFromFile(grid: GridFile): boolean {
    this.gridController = GridController.newFromFile(JSON.stringify(grid));
    return true;
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

  populateWithRandomFloats(sheetId: string, width: number, height: number): void {
    const summary = this.gridController.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height));
    transactionResponse(summary);
  }

  getSheetIds(): string[] {
    const data = this.gridController.getSheetIds();
    return JSON.parse(data);
  }

  addSheet(cursor: SheetCursorSave): void {
    const summary = this.gridController.addSheet(JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  deleteSheet(sheetId: string, cursor: SheetCursorSave): void {
    const summary = this.gridController.deleteSheet(sheetId, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  setSheetName(sheetId: string, name: string, cursor: SheetCursorSave): void {
    const summary = this.gridController.setSheetName(sheetId, name, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: SheetCursorSave): void {
    const summary = this.gridController.setSheetColor(sheetId, color, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  duplicateSheet(sheetId: string, cursor: SheetCursorSave): void {
    const summary = this.gridController.duplicateSheet(sheetId, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  moveSheet(sheetId: string, leftSheetId: string | undefined, cursor: SheetCursorSave): void {
    const summary = this.gridController.moveSheet(sheetId, leftSheetId, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion

  //#region set grid operations
  //-----------------------------

  setCellValue(options: { sheetId: string; x: number; y: number; value: string; cursor: SheetCursorSave }): void {
    const summary = this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      options.value,
      JSON.stringify(options.cursor)
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

  deleteCellValues(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): void {
    const summary = this.gridController.deleteCellValues(sheetId, rectangleToRect(rectangle), JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellAlign(sheetId: string, rectangle: Rectangle, align: CellAlign | undefined, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellAlign(
      sheetId,
      rectangleToRect(rectangle),
      align,
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellWrap(sheetId: string, rectangle: Rectangle, wrap: CellWrap, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellWrap(sheetId, rectangleToRect(rectangle), wrap, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellCurrency(sheetId: string, rectangle: Rectangle, symbol: string, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellCurrency(
      sheetId,
      rectangleToRect(rectangle),
      symbol,
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellPercentage(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellPercentage(sheetId, rectangleToRect(rectangle), JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  removeCellNumericFormat(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): void {
    const summary = this.gridController.removeCellNumericFormat(
      sheetId,
      rectangleToRect(rectangle),
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellBold(sheetId, rectangleToRect(rectangle), bold, JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean, cursor: SheetCursorSave): void {
    const summary = this.gridController.setCellItalic(
      sheetId,
      rectangleToRect(rectangle),
      italic,
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellTextColor(
    sheetId: string,
    rectangle: Rectangle,
    textColor: string | undefined,
    cursor: SheetCursorSave
  ): void {
    const summary = this.gridController.setCellTextColor(
      sheetId,
      rectangleToRect(rectangle),
      textColor,
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  setCellFillColor(
    sheetId: string,
    rectangle: Rectangle,
    fillColor: string | undefined,
    cursor: SheetCursorSave
  ): void {
    const summary = this.gridController.setCellFillColor(
      sheetId,
      rectangleToRect(rectangle),
      fillColor,
      JSON.stringify(cursor)
    );
    transactionResponse(summary);
    this.dirty = true;
  }

  changeDecimalPlaces(
    sheetId: string,
    source: Pos,
    rectangle: Rectangle,
    delta: number,
    cursor: SheetCursorSave
  ): void {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const summary = this.gridController.changeDecimalPlaces(
      sheetId,
      source,
      rectangleToRect(rectangle),
      delta,
      JSON.stringify(cursor)
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
    const cursor = sheets.sheet.cursor.save();
    const summary = this.gridController.undo(JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  redo(): void {
    const cursor = sheets.sheet.cursor.save();
    const summary = this.gridController.redo(JSON.stringify(cursor));
    transactionResponse(summary);
    this.dirty = true;
  }

  //#endregion
}

export const grid = new Grid();
