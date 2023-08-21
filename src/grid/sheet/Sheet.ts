import { Rectangle } from 'pixi.js';
import { Coordinate } from '../../gridGL/types/size';
import {
  CellAlign,
  CellFormatSummary,
  CodeCellValue,
  FormattingSummary,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  TransactionSummary,
} from '../../quadratic-core/types';
import { Grid } from '../controller/Grid';
import { SheetController } from '../controller/SheetController';
import { transactionResponse } from '../controller/transactionResponse';
import { GridBorders } from './GridBorders';
import { GridOffsets } from './GridOffsets';
import { GridSparse } from './GridSparse';
import { SheetCursor } from './SheetCursor';

export class Sheet {
  private sheetController: SheetController;

  id: string;

  // @deprecated (soon)
  gridOffsets: GridOffsets;

  // @deprecated
  grid: GridSparse;

  borders: GridBorders;
  cursor: SheetCursor;

  constructor(sheetController: SheetController, index: number) {
    this.sheetController = sheetController;

    // deprecated
    this.grid = new GridSparse(this);

    const sheetId = this.gridNew.sheetIndexToId(index);
    if (!sheetId) throw new Error('Expected sheetId to be defined in Sheet');
    this.id = sheetId;

    this.gridOffsets = new GridOffsets();
    this.borders = new GridBorders(this.gridOffsets);

    this.cursor = new SheetCursor(this);
  }

  // todo: rename to grid after migration away from gridSparse
  get gridNew(): Grid {
    return this.sheetController.grid;
  }

  // for testing
  clear() {
    // todo
    // this.gridOffsets = new GridOffsets();
    // this.grid = new GridSparse(this);
    // this.borders = new GridBorders(this.gridOffsets);
    // this.render_dependency = new GridRenderDependency();
    // this.array_dependency = new GridRenderDependency();
    // this.cell_dependency = new CellDependencyManager();
    // this.cursor = new SheetCursor(this);
  }

  //#region set sheet actions
  // -----------------------------------

  private save(): void {
    this.sheetController.save?.();
  }

  setCellValue(x: number, y: number, value: string): void {
    const summary = this.gridNew.setCellValue({ sheetId: this.id, x, y, value, cursor: this.cursor.save() });
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  deleteCells(rectangle: Rectangle): void {
    const summary = this.gridNew.deleteCellValues(this.id, rectangle, this.cursor.save());
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  set name(name: string) {
    const summary = this.gridNew.setSheetName(this.id, name, this.cursor.save());
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  set color(color: string | undefined) {
    const summary = this.gridNew.setSheetColor(this.id, color, this.cursor.save());
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  //#endregion

  //#region get grid information

  get name(): string {
    const name = this.gridNew.getSheetName(this.id);
    if (name === undefined) throw new Error('Expected name to be defined in Sheet');
    return name;
  }

  get color(): string | undefined {
    return this.gridNew.getSheetColor(this.id);
  }

  get order(): string {
    const order = this.gridNew.getSheetOrder(this.id);
    if (order === undefined) throw new Error('Expected order to be defined in Sheet');
    return order.toString();
  }

  getRenderCells(rectangle: Rectangle): JsRenderCell[] {
    return this.gridNew.getRenderCells(this.id, rectangle);
  }

  getRenderCell(x: number, y: number): JsRenderCell | undefined {
    return this.gridNew.getRenderCells(this.id, new Rectangle(x, y, 0, 0))?.[0];
  }

  getRenderFills(rectangle: Rectangle): JsRenderFill[] {
    return this.gridNew.getRenderFills(this.id, rectangle);
  }

  getAllRenderFills(): JsRenderFill[] {
    return this.gridNew.getAllRenderFills(this.id);
  }

  getRenderCodeCells(): JsRenderCodeCell[] {
    return this.gridNew.getRenderCodeCells(this.id);
  }

  getCodeValue(x: number, y: number): CodeCellValue | undefined {
    return this.gridNew.getCodeValue(this.id, x, y);
  }

  getFormattingSummary(rectangle: Rectangle): FormattingSummary {
    return this.gridNew.getFormattingSummary(this.id, rectangle);
  }

  getCellFormatSummary(x: number, y: number): CellFormatSummary {
    return this.gridNew.getCellFormatSummary(this.id, x, y);
  }

  getGridBounds(onlyData: boolean): Rectangle | undefined {
    return this.gridNew.getGridBounds(this.id, onlyData);
  }

  getMinMax(onlyData: boolean): Coordinate[] | undefined {
    const bounds = this.getGridBounds(onlyData);
    if (!bounds) return;
    return [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
    ];
  }

  getGridRowMinMax(row: number, onlyData: boolean): Coordinate[] | undefined {
    const gridRowMinMax = this.grid.getRowMinMax(row, onlyData);
    if (onlyData) {
      if (!gridRowMinMax) return;
      return [
        { x: gridRowMinMax.min, y: row },
        { x: gridRowMinMax.max, y: row },
      ];
    }
    const bordersRowMinMax = this.borders.getRowMinMax(row);
    if (!gridRowMinMax && !bordersRowMinMax) return;
    if (!gridRowMinMax) {
      return [
        { x: bordersRowMinMax.min, y: row },
        { x: bordersRowMinMax.max, y: row },
      ];
    }
    if (!bordersRowMinMax) {
      return [
        { x: gridRowMinMax.min, y: row },
        { x: gridRowMinMax.max, y: row },
      ];
    }
    return [
      { x: Math.min(gridRowMinMax.min, bordersRowMinMax.min), y: row },
      { x: Math.max(gridRowMinMax.max, bordersRowMinMax.max), y: row },
    ];
  }

  getGridColumnMinMax(column: number, onlyData: boolean): Coordinate[] | undefined {
    const gridColumnMinMax = this.grid.getColumnMinMax(column, onlyData);
    if (onlyData) {
      if (!gridColumnMinMax) return;
      return [
        { x: column, y: gridColumnMinMax.min },
        { x: column, y: gridColumnMinMax.max },
      ];
    }
    const bordersColumnMinMax = this.borders.getColumnMinMax(column);
    if (!gridColumnMinMax && !bordersColumnMinMax) return;
    if (!gridColumnMinMax) {
      return [
        { x: column, y: bordersColumnMinMax!.min },
        { x: column, y: bordersColumnMinMax!.max },
      ];
    }
    if (!bordersColumnMinMax) {
      return [
        { x: column, y: gridColumnMinMax.min },
        { x: column, y: gridColumnMinMax.max },
      ];
    }
    return [
      { x: column, y: Math.min(gridColumnMinMax.min, bordersColumnMinMax.min) },
      { x: column, y: Math.max(gridColumnMinMax.max, bordersColumnMinMax.max) },
    ];
  }

  //#endregion

  //#region set grid information

  setCellFillColor(rectangle: Rectangle, fillColor?: string): TransactionSummary {
    return this.gridNew.setCellFillColor(this.id, rectangle, fillColor, this.cursor.save());
  }

  setCellBold(rectangle: Rectangle, bold: boolean): TransactionSummary {
    return this.gridNew.setCellBold(this.id, rectangle, bold, this.cursor.save());
  }

  setCellItalic(rectangle: Rectangle, italic: boolean): TransactionSummary {
    return this.gridNew.setCellItalic(this.id, rectangle, italic, this.cursor.save());
  }

  setCellTextColor(rectangle: Rectangle, color?: string): TransactionSummary {
    return this.gridNew.setCellTextColor(this.id, rectangle, color, this.cursor.save());
  }

  setCellAlign(rectangle: Rectangle, align?: CellAlign): TransactionSummary {
    return this.gridNew.setCellAlign(this.id, rectangle, align, this.cursor.save());
  }

  clearFormatting(rectangle: Rectangle): TransactionSummary {
    throw new Error('Not implemented yet');
  }

  //#endregion
}
