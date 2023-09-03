import { Point, Rectangle } from 'pixi.js';
import { GridController, Pos, Rect as RectInternal } from '../../quadratic-core/quadratic_core';
import {
  CellAlign,
  CellFormatSummary,
  CellValue,
  CellWrap,
  CodeCellValue,
  FormattingSummary,
  JsClipboard,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  NumericFormat,
  Rect,
  TransactionSummary,
} from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { SheetCursorSave } from '../sheet/SheetCursor';

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
  // should be private after migration
  gridController?: GridController;

  // import/export

  constructor() {
    this.gridController = new GridController();
  }

  newFromFile(grid: GridFile): void {
    this.gridController = GridController.newFromFile(grid);
  }

  //#region get sheet information
  //-------------------------

  sheetIndexToId(index: number): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.sheetIndexToId(index);
  }

  getSheetOrder(sheetId: string): string {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getSheetOrder(sheetId);
  }

  getSheetName(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getSheetName(sheetId);
  }

  getSheetColor(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getSheetColor(sheetId);
  }

  //#endregion

  //#region set sheet operations
  //------------------------

  populateWithRandomFloats(sheetId: string, width: number, height: number): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height));
  }

  getSheetIds(): string[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getSheetIds();
    return JSON.parse(data);
  }

  addSheet(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.addSheet(JSON.stringify(cursor));
  }

  deleteSheet(sheetId: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.deleteSheet(sheetId, JSON.stringify(cursor));
  }

  setSheetName(sheetId: string, name: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.setSheetName(sheetId, name, JSON.stringify(cursor));
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.setSheetColor(sheetId, color, JSON.stringify(cursor));
  }

  duplicateSheet(sheetId: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.duplicateSheet(sheetId, JSON.stringify(cursor));
  }

  moveSheet(sheetId: string, leftSheetId: string | undefined, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.moveSheet(sheetId, leftSheetId, JSON.stringify(cursor));
  }

  //#endregion

  //#region set grid operations
  //-----------------------------

  setCellValue(options: {
    sheetId: string;
    x: number;
    y: number;
    value: string;
    cursor: SheetCursorSave;
  }): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const cellValue: CellValue = {
      type: 'text',
      value: options.value,
    };
    return this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      cellValue,
      JSON.stringify(options.cursor)
    );
  }

  setCodeCellValue(options: { sheetId: string; x: number; y: number; codeString: string }): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    // return this.gridController.set;
    throw new Error('not implemented yet...');
  }

  deleteCellValues(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.deleteCellValues(sheetId, rectangleToRect(rectangle), JSON.stringify(cursor));
  }

  setCellAlign(
    sheetId: string,
    rectangle: Rectangle,
    align: CellAlign | undefined,
    cursor: SheetCursorSave
  ): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_align(sheetId, rectangleToRect(rectangle), align, JSON.stringify(cursor));
  }

  setCellWrap(sheetId: string, rectangle: Rectangle, wrap: CellWrap, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_wrap(sheetId, rectangleToRect(rectangle), wrap, JSON.stringify(cursor));
  }

  setCellNumericFormat(
    sheetId: string,
    rectangle: Rectangle,
    numericFormat: NumericFormat,
    cursor: SheetCursorSave
  ): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_numeric_format(
      sheetId,
      rectangleToRect(rectangle),
      numericFormat,
      JSON.stringify(cursor)
    );
  }

  setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_bold(sheetId, rectangleToRect(rectangle), bold, JSON.stringify(cursor));
  }

  setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_italic(sheetId, rectangleToRect(rectangle), italic, JSON.stringify(cursor));
  }

  setCellTextColor(
    sheetId: string,
    rectangle: Rectangle,
    textColor: string | undefined,
    cursor: SheetCursorSave
  ): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_text_color(
      sheetId,
      rectangleToRect(rectangle),
      textColor,
      JSON.stringify(cursor)
    );
  }

  setCellFillColor(
    sheetId: string,
    rectangle: Rectangle,
    fillColor: string | undefined,
    cursor: SheetCursorSave
  ): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_set_cell_fill_color(
      sheetId,
      rectangleToRect(rectangle),
      fillColor,
      JSON.stringify(cursor)
    ) as TransactionSummary;
  }

  clearFormatting(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.js_clear_formatting(sheetId, rectangleToRect(rectangle), JSON.stringify(cursor));
  }

  //#endregion

  //#region get grid information
  // ---------------------------

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderFills(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getAllRenderFills(sheetId: string): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getAllRenderFills(sheetId);
    return JSON.parse(data);
  }

  getGridBounds(sheetId: string, ignoreFormatting: boolean): Rectangle | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const bounds = this.gridController.getGridBounds(sheetId, ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return new Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  }

  getCodeValue(sheetId: string, x: number, y: number): CodeCellValue | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getCodeCellValue(sheetId, new Pos(x, y));
  }

  getRenderCodeCells(sheetId: string): JsRenderCodeCell[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getAllRenderCodeCells(sheetId);
    return JSON.parse(data);
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): CellFormatSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getCellFormatSummary(sheetId, new Pos(x, y));
  }

  getFormattingSummary(sheetId: string, rectangle: Rectangle): FormattingSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getFormattingSummary(sheetId, rectangleToRect(rectangle) as RectInternal);
  }

  //#endregion

  //#region Undo/redo
  //-----------------

  hasUndo(): boolean {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.hasUndo();
  }

  hasRedo(): boolean {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.hasRedo();
  }

  undo(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.undo(JSON.stringify(cursor));
  }

  redo(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.redo(JSON.stringify(cursor));
  }

  //#endregion

  //#region Clipboard
  copyToClipboard(sheetId: string, rectangle: Rectangle): JsClipboard {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.copyToClipboard(sheetId, rectangleToRect(rectangle));
  }

  cutToClipboard(sheetId: string, rectangle: Rectangle, cursor: SheetCursorSave): JsClipboard {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.cutToClipboard(sheetId, rectangleToRect(rectangle), JSON.stringify(cursor));
  }

  pasteFromClipboard(options: {
    sheetId: string;
    x: number;
    y: number;
    plainText: string | undefined;
    html: string | undefined;
    cursor: SheetCursorSave;
  }): TransactionSummary {
    const { sheetId, x, y, plainText, html, cursor } = options;
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.pasteFromClipboard(sheetId, new Pos(x, y), plainText, html, JSON.stringify(cursor));
  }

  //#endregion
}
