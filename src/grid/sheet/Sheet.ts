import { Rectangle } from 'pixi.js';
import { Coordinate } from '../../gridGL/types/size';
import { JsRenderCell, JsRenderFill } from '../../quadratic-core/types';
import { Cell, CellFormat } from '../../schemas';
import { Grid } from '../controller/Grid';
import { SheetController } from '../controller/SheetController';
import { transactionResponse } from '../controller/transactionResponse';
import { GridBorders } from './GridBorders';
import { GridOffsets } from './GridOffsets';
import { CellAndFormat, GridSparse } from './GridSparse';
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
  private get gridNew(): Grid {
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

  // user initiated sheet actions
  // ----------------------------

  private save(): void {
    this.sheetController.saveLocalFiles?.();
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

  get name(): string {
    const name = this.gridNew.getSheetName(this.id);
    if (name === undefined) throw new Error('Expected name to be defined in Sheet');
    return name;
  }
  set name(name: string) {
    const summary = this.gridNew.setSheetName(this.id, name, this.cursor.save());
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  get color(): string | undefined {
    return this.gridNew.getSheetColor(this.id);
  }
  set color(color: string | undefined) {
    const summary = this.gridNew.setSheetColor(this.id, color, this.cursor.save());
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  get order(): string {
    const order = this.gridNew.getSheetOrder(this.id);
    if (order === undefined) throw new Error('Expected order to be defined in Sheet');
    return order.toString();
  }

  getRenderCells(rectangle: Rectangle): JsRenderCell[] {
    return this.gridNew.getRenderCells(this.id, rectangle);
  }

  getRenderFills(rectangle: Rectangle): JsRenderFill[] {
    return this.gridNew.getRenderFills(this.id, rectangle);
  }

  protected copyCell(cell: Cell | undefined): Cell | undefined {
    if (!cell) return undefined;
    return {
      ...cell,
      evaluation_result: cell.evaluation_result ? { ...cell.evaluation_result } : undefined,
    };
  }

  protected copyFormat(format: CellFormat | undefined): CellFormat | undefined {
    if (!format) return undefined;
    return {
      ...format,
      textFormat: format.textFormat ? { ...format.textFormat } : undefined,
    };
  }

  getCellCopy(x: number, y: number): Cell | undefined {
    // proper deep copy of a cell
    const cell = this.grid.get(x, y);
    if (!cell || !cell.cell) return;
    return this.copyCell(cell.cell);
  }

  getCellAndFormatCopy(x: number, y: number): CellAndFormat | undefined {
    const cell = this.grid.get(x, y);
    if (!cell) return;
    return {
      cell: this.copyCell(cell.cell),
      format: this.copyFormat(cell.format),
    };
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

  hasQuadrant(x: number, y: number): boolean {
    return (
      this.grid.hasQuadrant(x, y) || this.borders.hasQuadrant(x, y)
      // this.render_dependency.hasQuadrant(x, y) ||
      // this.array_dependency.hasQuadrant(x, y)
    );
  }

  recalculateBounds(): void {
    this.grid.recalculateBounds();
  }
}
