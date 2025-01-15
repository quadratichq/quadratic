import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { GridOverflowLines } from '@/app/grid/sheet/GridOverflowLines';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import { ColumnRow, GridBounds, JsCoordinate, SheetBounds, SheetInfo, Validation } from '@/app/quadratic-core-types';
import { SheetOffsets, SheetOffsetsWasm, stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';

export class Sheet {
  id: string;
  cursor: SheetCursor;

  name: string;
  order: string;
  color?: string;

  offsets: SheetOffsets;
  bounds: GridBounds;
  boundsWithoutFormatting: GridBounds;

  // tracks which Grid lines should not be drawn b/c of overflow
  gridOverflowLines: GridOverflowLines;

  validations: Validation[] = [];

  // clamp is the area that the cursor can move around in
  clamp: Rectangle;

  constructor(info: SheetInfo, testSkipOffsetsLoad = false) {
    this.id = info.sheet_id;
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = testSkipOffsetsLoad ? ({} as SheetOffsets) : SheetOffsetsWasm.load(info.offsets);
    this.cursor = new SheetCursor(this);
    this.bounds = info.bounds;
    this.boundsWithoutFormatting = info.bounds_without_formatting;
    this.gridOverflowLines = new GridOverflowLines();

    // this will be imported via SheetInfo in the future
    this.clamp = new Rectangle(1, 1, Infinity, Infinity);

    events.on('sheetBounds', this.updateBounds);
    events.on('sheetValidations', this.sheetValidations);
  }

  private sheetValidations = (sheetId: string, validations: Validation[]) => {
    if (sheetId === this.id) {
      this.validations = validations;
    }
  };

  // Returns all validations that intersect with the given point.
  getValidation(x: number, y: number): Validation[] | undefined {
    return this.validations.filter((v) => {
      const selection = stringToSelection(v.selection.toString(), this.id, sheets.getSheetIdNameMap());
      return selection.contains(x, y);
    });
  }

  static testSheet(): Sheet {
    return new Sheet(
      {
        sheet_id: 'test-sheet',
        name: 'Test Sheet',
        order: '1',
        color: 'red',
        offsets: '',
        bounds: { type: 'empty' },
        bounds_without_formatting: { type: 'empty' },
      },
      true
    );
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

  updateSheetInfo(info: SheetInfo) {
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = SheetOffsetsWasm.load(info.offsets);
  }

  //#endregion

  //#region get grid information
  getMinMax(onlyData: boolean): JsCoordinate[] | undefined {
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
      Number(bounds.max.x) - Number(bounds.min.x) + 1,
      Number(bounds.max.y) - Number(bounds.min.y) + 1
    );
  }

  //#region Offsets

  // @returns screen position of a cell
  getCellOffsets(column: number | BigInt, row: number | BigInt): Rectangle {
    // this check is needed b/c offsets may be in a weird state during hmr
    if (!this.offsets.getCellOffsets) return new Rectangle();

    const screenRect = this.offsets.getCellOffsets(Number(column), Number(row));
    return new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  }

  // @returns the x position of the column
  getColumnX(x: number): number {
    return this.offsets.getColumnPlacement(x).position;
  }

  // @returns the y position of the row
  getRowY(y: number): number {
    return this.offsets.getRowPlacement(y).position;
  }

  getColumnRow(x: number, y: number): JsCoordinate {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    const columnRow: ColumnRow = JSON.parse(columnRowStringified);
    return { x: columnRow.column, y: columnRow.row };
  }

  // @returns screen rectangle for a column/row rectangle
  getScreenRectangle(
    column: number | BigInt,
    row: number | BigInt,
    width: number | BigInt,
    height: number | BigInt
  ): Rectangle {
    const topLeft = this.getCellOffsets(Number(column), Number(row));
    const bottomRight = this.getCellOffsets(Number(column) + Number(width), Number(row) + Number(height));
    return new Rectangle(topLeft.left, topLeft.top, bottomRight.left - topLeft.left, bottomRight.top - topLeft.top);
  }

  // @returns screen rectangle from a selection rectangle
  getScreenRectangleFromRect(rect: Rectangle): Rectangle {
    return this.getScreenRectangle(rect.x, rect.y, rect.width, rect.height);
  }

  updateSheetOffsets(column: number | null, row: number | null, size: number) {
    if (column !== null) {
      this.offsets.setColumnWidth(column, size);
    } else if (row !== null) {
      this.offsets.setRowHeight(row, size);
    }
  }

  getColumnFromScreen(x: number): number {
    return this.offsets.getColumnFromScreen(x);
  }

  getRowFromScreen(y: number): number {
    return this.offsets.getRowFromScreen(y);
  }

  getColumnRowFromScreen(x: number, y: number): ColumnRow {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    return JSON.parse(columnRowStringified);
  }

  //#endregion

  getValidationById(id: string): Validation | undefined {
    return this.validations.find((v) => v.id === id);
  }
}
