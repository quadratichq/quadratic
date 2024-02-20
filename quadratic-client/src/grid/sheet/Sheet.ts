import { SheetOffsets } from '@/quadratic-grid-metadata/quadratic_grid_metadata';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { Coordinate } from '../../gridGL/types/size';
import { Pos } from '../../quadratic-core/quadratic_core';
import { CellAlign, CellFormatSummary, FormattingSummary, JsRenderCell } from '../../quadratic-core/types';
import { grid } from '../controller/Grid';
import { metadata } from '../controller/metadata';
import { SheetCursor } from './SheetCursor';

export class Sheet {
  id: string;
  cursor: SheetCursor;

  name: string;
  order: string;
  color?: string;

  constructor(sheetId: string) {
    if (sheetId === 'test') {
      this.id = 'test';
      // this.offsets = new SheetOffsets();
      this.name = 'test';
      this.order = 'A0';
    } else {
      this.id = sheetId;
      const sheetInfo = metadata.sheetInfo.get(sheetId);
      if (!sheetInfo) {
        throw new Error('Expected sheetInfo to be defined in Sheet constructor');
      }
      this.name = sheetInfo.name;
      this.order = sheetInfo.order;
      this.color = sheetInfo.color;
    }
    this.cursor = new SheetCursor(this);
  }

  get offsets(): SheetOffsets {
    const offsets = metadata.offsets.get(this.id);
    if (!offsets) {
      throw new Error('Expected SheetOffsets to be defined in get offsets');
    }
    return offsets;
  }

  updateMetadata() {
    this.name = grid.getSheetName(this.id) ?? '';
    this.order = grid.getSheetOrder(this.id);
    this.color = grid.getSheetColor(this.id);
  }

  //#region set sheet actions
  // -----------------------------------

  setName(name: string): void {
    if (name !== this.name) {
      grid.setSheetName(this.id, name);
      this.name = name;
    }
  }

  deleteCells(rectangle: Rectangle): void {
    grid.deleteCellValues(this.id, rectangle);
  }

  //#endregion

  //#region get grid information

  getRenderCells(rectangle: Rectangle): JsRenderCell[] {
    return grid.getRenderCells(this.id, rectangle);
  }

  getRenderCell(x: number, y: number): JsRenderCell | undefined {
    return grid.getRenderCells(this.id, new Rectangle(x, y, 0, 0))?.[0];
  }

  getFormattingSummary(rectangle: Rectangle): FormattingSummary {
    return grid.getFormattingSummary(this.id, rectangle);
  }

  // getCellFormatSummary(x: number, y: number): CellFormatSummary {
  //   return grid.getCellFormatSummary(this.id, x, y);
  // }

  getGridBounds(onlyData: boolean): Rectangle | undefined {
    return grid.getGridBounds(this.id, onlyData);
  }

  getMinMax(onlyData: boolean): Coordinate[] | undefined {
    const bounds = this.getGridBounds(onlyData);
    if (!bounds) return;
    return [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
    ];
  }

  //#region set grid information

  setCellFillColor(rectangle: Rectangle, fillColor?: string) {
    return grid.setCellFillColor(this.id, rectangle, fillColor);
  }

  setCellBold(rectangle: Rectangle, bold: boolean): void {
    grid.setCellBold(this.id, rectangle, bold);
  }

  setCellItalic(rectangle: Rectangle, italic: boolean): void {
    grid.setCellItalic(this.id, rectangle, italic);
  }

  setCellTextColor(rectangle: Rectangle, color?: string): void {
    grid.setCellTextColor(this.id, rectangle, color);
  }

  setCellAlign(rectangle: Rectangle, align?: CellAlign): void {
    grid.setCellAlign(this.id, rectangle, align);
  }

  setCurrency(rectangle: Rectangle, symbol: string = '$') {
    grid.setCellCurrency(this.id, rectangle, symbol);
  }

  setPercentage(rectangle: Rectangle) {
    grid.setCellPercentage(this.id, rectangle);
  }

  setExponential(rectangle: Rectangle) {
    grid.setCellExponential(this.id, rectangle);
  }

  removeCellNumericFormat(rectangle: Rectangle) {
    grid.removeCellNumericFormat(this.id, rectangle);
  }

  changeDecimals(delta: number): void {
    grid.changeDecimalPlaces(
      this.id,
      new Pos(this.cursor.originPosition.x, this.cursor.originPosition.y),
      this.cursor.getRectangle(),
      delta
    );
  }

  clearFormatting(): void {
    grid.clearFormatting(this.id, this.cursor.getRectangle());
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

  // todo...
  updateSheetOffsets() {
    throw new Error('todo updateSheetOffsets');
    // const newOffsets = grid.getOffsets(this.id);
    // const offsetSizeChanges: OffsetsSizeChanges = this.offsets.findResizeChanges(newOffsets);
    // const columns = offsetSizeChanges.getChanges(true);
    // for (let i = 0; i < columns.length; i += 2) {
    //   const index = columns[i];
    //   const delta = columns[i + 1];
    //   pixiApp.cellsSheets.adjustHeadings({ sheetId: this.id, column: index, delta });
    // }
    // this.offsets.free();
    // this.offsets = newOffsets;
  }

  //#endregion
}
