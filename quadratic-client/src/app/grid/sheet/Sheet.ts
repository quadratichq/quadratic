import { events } from '@/app/events/events';
import type { Sheets } from '@/app/grid/controller/Sheets';
import { GridOverflowLines } from '@/app/grid/sheet/GridOverflowLines';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import type {
  ColumnRow,
  GridBounds,
  JsCoordinate,
  SheetBounds,
  SheetInfo,
  Validation,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import {
  SheetContentCache,
  SheetDataTablesCache,
  type SheetOffsets,
  SheetOffsetsWasm,
} from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';

export class Sheet {
  sheets: Sheets;

  private info: SheetInfo;

  cursor: SheetCursor;
  offsets: SheetOffsets;

  // tracks which Grid lines should not be drawn b/c of overflow
  gridOverflowLines: GridOverflowLines;

  validations: Validation[] = [];

  // clamp is the area that the cursor can move around in
  clamp: Rectangle;

  private _contentCache: SheetContentCache;
  private _tablesCache: SheetDataTablesCache;

  constructor(sheets: Sheets, info: SheetInfo, testSkipOffsetsLoad = false) {
    this.info = info;
    this.sheets = sheets;
    this.offsets = testSkipOffsetsLoad ? ({} as SheetOffsets) : SheetOffsetsWasm.load(info.offsets);
    this.cursor = new SheetCursor(this);
    this.gridOverflowLines = new GridOverflowLines(this);

    // this will be imported via SheetInfo in the future
    this.clamp = new Rectangle(1, 1, Infinity, Infinity);

    this._contentCache = SheetContentCache.new_empty();
    this._tablesCache = SheetDataTablesCache.new_empty();

    events.on('sheetBounds', this.updateBounds);
    events.on('sheetValidations', this.sheetValidations);
    events.on('contentCache', this.updateContentCache);
    events.on('dataTablesCache', this.updateTablesCache);
  }

  get id(): string {
    return this.info.sheet_id;
  }

  get name(): string {
    return this.info.name;
  }

  get order(): string {
    return this.info.order;
  }

  get color(): string | undefined {
    return this.info.color ?? undefined;
  }

  get bounds(): GridBounds {
    return this.info.bounds;
  }

  get boundsWithoutFormatting(): GridBounds {
    return this.info.bounds_without_formatting;
  }

  get formatBounds(): GridBounds {
    return this.info.format_bounds;
  }

  destroy() {
    this.contentCache.free();
    events.off('sheetBounds', this.updateBounds);
    events.off('sheetValidations', this.sheetValidations);
    events.off('contentCache', this.updateContentCache);
  }

  get contentCache(): SheetContentCache {
    return this._contentCache;
  }

  get dataTablesCache(): SheetDataTablesCache {
    return this._tablesCache;
  }

  private updateContentCache = (sheetId: string, contentCache: SheetContentCache) => {
    if (sheetId === this.id) {
      this.contentCache.free();
      this._contentCache = contentCache;
    }
  };

  private updateTablesCache = (sheetId: string, tablesCache: SheetDataTablesCache) => {
    if (sheetId === this.id) {
      this._tablesCache.free();
      this._tablesCache = tablesCache;
    }
  };

  private sheetValidations = (sheetId: string, sheetValidations: Validation[]) => {
    if (sheetId === this.id) {
      this.validations = sheetValidations;
    }
  };

  // Returns all validations that intersect with the given point.
  getValidation = (x: number, y: number): Validation[] | undefined => {
    return this.validations.filter((v) => {
      const jsSelection = this.sheets.A1SelectionToJsSelection(v.selection);
      const contains = jsSelection.contains(x, y, this.sheets.jsA1Context);
      jsSelection.free();
      return contains;
    });
  };

  private updateBounds = (sheetsBounds: SheetBounds) => {
    if (this.id === sheetsBounds.sheet_id) {
      this.info.bounds = sheetsBounds.bounds;
      this.info.bounds_without_formatting = sheetsBounds.bounds_without_formatting;
    }
  };

  //#region set sheet actions
  // -----------------------------------

  setName = (name: string): void => {
    if (name !== this.name) {
      quadraticCore.setSheetName(this.id, name);
      this.info.name = name;
    }
  };

  setColor = (color: string | undefined): void => {
    if (color !== this.color) {
      quadraticCore.setSheetColor(this.id, color);
      this.info.color = color ?? null;
    }
  };

  updateSheetInfo = (info: SheetInfo) => {
    this.info.name = info.name;
    this.info.order = info.order;
    this.info.color = info.color ?? null;
    this.offsets.free();
    this.offsets = SheetOffsetsWasm.load(info.offsets);
  };

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
  getScreenRectangleFromRectangle(rect: Rectangle): Rectangle {
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

  // @returns the rectangle in cell coordinates from screen coordinates
  getRectangleFromScreen(rectangle: Rectangle): Rectangle {
    const start = this.getColumnRowFromScreen(rectangle.x, rectangle.y);
    const end = this.getColumnRowFromScreen(rectangle.right + 1, rectangle.bottom + 1);
    return new Rectangle(start.column, start.row, end.column - start.column + 1, end.row - start.row + 1);
  }

  //#endregion

  getValidationById(id: string): Validation | undefined {
    return this.validations.find((v) => v.id === id);
  }

  // Returns the content bounds in viewport coordinates from 0,0 to the
  // bottom-right of the content.
  getScrollbarBounds(): Rectangle {
    const bounds = this.bounds;
    if (bounds.type === 'empty') return new Rectangle();
    const bottomRight = this.getCellOffsets(Number(bounds.max.x) + 1, Number(bounds.max.y) + 1);
    return new Rectangle(0, 0, bottomRight.left, bottomRight.top);
  }

  addCheckbox() {
    const validation: ValidationUpdate = {
      id: null,
      selection: this.cursor.selection(),
      rule: { Logical: { show_checkbox: true, ignore_blank: true } },
      message: {
        show: false,
        title: '',
        message: '',
      },
      error: {
        show: true,
        style: 'Stop',
        title: '',
        message: '',
      },
    };
    quadraticCore.updateValidation(validation);
  }

  hasContent(col: number, row: number): boolean {
    return this.contentCache.hasContent(col, row);
  }

  hasContentInRect(rect: Rectangle): boolean {
    return this.contentCache.hasContentInRect(rect.x, rect.y, rect.right - 1, rect.bottom - 1);
  }
}
