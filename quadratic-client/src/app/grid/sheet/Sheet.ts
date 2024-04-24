import { events } from '@/app/events/events';
import { CellAlign, CellFormatSummary, GridBounds, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import { SheetOffsets, SheetOffsetsWasm } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { Coordinate } from '../../gridGL/types/size';
import { sheets } from '../controller/Sheets';
import { SheetCursor } from './SheetCursor';

export class Sheet {
  id: string;
  cursor: SheetCursor;

  name: string;
  order: string;
  color?: string;

  offsets: SheetOffsets;
  bounds: GridBounds;
  boundsWithoutFormatting: GridBounds;

  constructor(info: SheetInfo) {
    this.id = info.sheet_id;
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = SheetOffsetsWasm.load(info.offsets);
    this.cursor = new SheetCursor(this);
    this.bounds = info.bounds;
    this.boundsWithoutFormatting = info.bounds_without_formatting;
    events.on('sheetBounds', this.updateBounds);
  }

  private updateBounds = (sheetsBounds: SheetBounds) => {
    if (this.id === sheetsBounds.sheet_id) {
      this.bounds = sheetsBounds.bounds;
      this.boundsWithoutFormatting = sheetsBounds.bounds_without_formatting;
    }
  };

  //#region set sheet actions
  // -----------------------------------

  setName(name: string): void {
    if (name !== this.name) {
      quadraticCore.setSheetName(this.id, name, sheets.getCursorPosition());
      this.name = name;
    }
  }

  deleteCells(rectangle: Rectangle) {
    quadraticCore.deleteCellValues(this.id, rectangle, sheets.getCursorPosition());
  }

  updateSheetInfo(info: SheetInfo) {
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = SheetOffsetsWasm.load(info.offsets);
  }

  //#endregion

  //#region get grid information
  getMinMax(onlyData: boolean): Coordinate[] | undefined {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return [
      { x: Number(bounds.min.x), y: Number(bounds.min.y) },
      { x: Number(bounds.max.x), y: Number(bounds.max.y) },
    ];
  }

  getBounds(onlyData: boolean): Rectangle | undefined {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return new Rectangle(
      Number(bounds.min.x),
      Number(bounds.min.y),
      Number(bounds.max.x) - Number(bounds.min.x),
      Number(bounds.max.y) - Number(bounds.min.y)
    );
  }

  //#region set grid information

  setCellFillColor(rectangle: Rectangle, fillColor?: string) {
    quadraticCore.setCellFillColor(this.id, rectangle, fillColor, sheets.getCursorPosition());
  }

  setCellBold(rectangle: Rectangle, bold: boolean) {
    quadraticCore.setCellBold(this.id, rectangle, bold, sheets.getCursorPosition());
  }

  setCellItalic(rectangle: Rectangle, italic: boolean): void {
    quadraticCore.setCellItalic(this.id, rectangle, italic, sheets.getCursorPosition());
  }

  setCellTextColor(rectangle: Rectangle, color?: string): void {
    quadraticCore.setCellTextColor(this.id, rectangle, color, sheets.getCursorPosition());
  }

  setCellAlign(rectangle: Rectangle, align?: CellAlign): void {
    quadraticCore.setCellAlign(this.id, rectangle, align, sheets.getCursorPosition());
  }

  setCurrency(rectangle: Rectangle, symbol: string = '$') {
    quadraticCore.setCellCurrency(this.id, rectangle, symbol, sheets.getCursorPosition());
  }

  toggleCommas(source: Coordinate, rectangle: Rectangle) {
    quadraticCore.toggleCommas(this.id, source, rectangle, sheets.getCursorPosition());
  }

  setPercentage(rectangle: Rectangle) {
    quadraticCore.setCellPercentage(this.id, rectangle, sheets.getCursorPosition());
  }

  setExponential(rectangle: Rectangle) {
    quadraticCore.setCellExponential(this.id, rectangle, sheets.getCursorPosition());
  }

  removeCellNumericFormat(rectangle: Rectangle) {
    quadraticCore.removeCellNumericFormat(this.id, rectangle, sheets.getCursorPosition());
  }

  changeDecimals(delta: number): void {
    quadraticCore.changeDecimalPlaces(
      this.id,
      this.cursor.originPosition.x,
      this.cursor.originPosition.y,
      this.cursor.getRectangle(),
      delta,
      sheets.getCursorPosition()
    );
  }

  clearFormatting(): void {
    quadraticCore.clearFormatting(this.id, this.cursor.getRectangle());
  }

  async getFormatPrimaryCell(): Promise<CellFormatSummary> {
    return await quadraticCore.getCellFormatSummary(
      this.id,
      this.cursor.originPosition.x,
      this.cursor.originPosition.y
    );
  }

  //#endregion

  //#region Offsets

  // @returns screen position of a cell
  getCellOffsets(column: number, row: number): Rectangle {
    const screenRect = this.offsets.getCellOffsets(column, row);
    return new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  }

  // todo: change this to a JsValue instead of a Rust struct
  getColumnRow(x: number, y: number): Coordinate {
    const columnRow = this.offsets.getColumnRowFromScreen(x, y);
    const result = { x: columnRow.column, y: columnRow.row };
    columnRow.free();
    return result;
  }

  // @returns screen rectangle for a column/row rectangle
  getScreenRectangle(column: number, row: number, width: number, height: number): Rectangle {
    const topLeft = this.getCellOffsets(column, row);
    const bottomRight = this.getCellOffsets(column + width, row + height);
    return new Rectangle(topLeft.left, topLeft.top, bottomRight.right - topLeft.left, bottomRight.bottom - topLeft.top);
  }

  updateSheetOffsets(column: number | undefined, row: number | undefined, size: number) {
    if (column !== undefined) {
      this.offsets.setColumnWidth(column, size);
    } else if (row !== undefined) {
      this.offsets.setRowHeight(row, size);
    }
  }

  //#endregion
}
