import { events } from '@/app/events/events';
import type { Sheets } from '@/app/grid/controller/Sheets';
import { GridOverflowLines } from '@/app/grid/sheet/GridOverflowLines';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import type {
  ColumnRow,
  ConditionalFormatClient,
  GridBounds,
  JsCoordinate,
  JsResponse,
  Rect,
  SheetBounds,
  SheetInfo,
  Validation,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import {
  JsMergeCells,
  SheetContentCache,
  SheetDataTablesCache,
  type SheetOffsets,
  SheetOffsetsWasm,
} from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';

export class Sheet {
  sheets: Sheets;

  private _info: SheetInfo;

  cursor: SheetCursor;
  offsets: SheetOffsets;

  // tracks which Grid lines should not be drawn b/c of overflow
  gridOverflowLines: GridOverflowLines;

  validations: Validation[] = [];
  conditionalFormats: ConditionalFormatClient[] = [];

  // clamp is the area that the cursor can move around in
  clamp: Rectangle;

  private _contentCache: SheetContentCache;
  private _dataTablesCache: SheetDataTablesCache;

  private _mergeCells: JsMergeCells;

  constructor(sheets: Sheets, info: SheetInfo, testSkipOffsetsLoad = false) {
    this._info = info;
    this.sheets = sheets;
    this.offsets = testSkipOffsetsLoad ? ({} as SheetOffsets) : SheetOffsetsWasm.load(info.offsets);
    this.cursor = new SheetCursor(this);
    this.gridOverflowLines = new GridOverflowLines(this);

    // this will be imported via SheetInfo in the future
    this.clamp = new Rectangle(1, 1, Infinity, Infinity);

    this._contentCache = SheetContentCache.new_empty();
    this._dataTablesCache = SheetDataTablesCache.new_empty();
    this._mergeCells = new JsMergeCells();

    events.on('sheetBounds', this.updateBounds);
    events.on('sheetValidations', this.sheetValidations);
    events.on('sheetConditionalFormats', this.sheetConditionalFormats);
    events.on('contentCache', this.updateContentCache);
    events.on('dataTablesCache', this.updateTablesCache);
    events.on('mergeCells', this.updateMergeCells);
  }

  destroy() {
    this.contentCache.free();
    events.off('sheetBounds', this.updateBounds);
    events.off('sheetValidations', this.sheetValidations);
    events.off('sheetConditionalFormats', this.sheetConditionalFormats);
    events.off('contentCache', this.updateContentCache);
    events.off('dataTablesCache', this.updateTablesCache);
    this._mergeCells.free();
    events.off('mergeCells', this.updateMergeCells);
  }

  private updateMergeCells = (sheetId: string, mergeCells: JsMergeCells) => {
    if (sheetId === this.id) {
      this._mergeCells.free();
      this._mergeCells = mergeCells;
    }
  };

  get id(): string {
    return this._info.sheet_id;
  }

  get name(): string {
    return this._info.name;
  }

  get order(): string {
    return this._info.order;
  }

  get color(): string | undefined {
    return this._info.color ?? undefined;
  }

  get bounds(): GridBounds {
    return this._info.bounds;
  }

  get boundsWithoutFormatting(): GridBounds {
    return this._info.bounds_without_formatting;
  }

  get formatBounds(): GridBounds {
    return this._info.format_bounds;
  }

  get contentCache(): SheetContentCache {
    return this._contentCache;
  }

  get dataTablesCache(): SheetDataTablesCache {
    return this._dataTablesCache;
  }

  get mergeCells(): JsMergeCells {
    return this._mergeCells;
  }

  private updateContentCache = (sheetId: string, contentCache: SheetContentCache) => {
    if (sheetId === this.id) {
      this.contentCache.free();
      this._contentCache = contentCache;
    }
  };

  private updateTablesCache = (sheetId: string, tablesCache: SheetDataTablesCache) => {
    if (sheetId === this.id) {
      this.dataTablesCache.free();
      this._dataTablesCache = tablesCache;
    }
  };

  private sheetValidations = (sheetId: string, sheetValidations: Validation[]) => {
    if (sheetId === this.id) {
      this.validations = sheetValidations;
    }
  };

  private sheetConditionalFormats = (sheetId: string, conditionalFormats: ConditionalFormatClient[]) => {
    if (sheetId === this.id) {
      this.conditionalFormats = conditionalFormats;
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
      this._info.bounds = sheetsBounds.bounds;
      this._info.bounds_without_formatting = sheetsBounds.bounds_without_formatting;
    }
  };

  //#region set sheet actions
  // -----------------------------------

  setName = async (name: string, isAi: boolean): Promise<void> => {
    if (name !== this.name) {
      const response = await quadraticCore.setSheetName(this.id, name, isAi);
      if (response?.result) {
        this._info.name = name;
      }
    }
  };

  setColor = async (color: string | undefined, isAi: boolean): Promise<void> => {
    if (color !== this.color) {
      const response = await quadraticCore.setSheetColor(this.id, color, isAi);
      if (response?.result) {
        this._info.color = color ?? null;
      }
    }
  };

  updateSheetInfo = (info: SheetInfo) => {
    this._info.name = info.name;
    this._info.order = info.order;
    this._info.color = info.color ?? null;
    this.offsets.free();
    this.offsets = SheetOffsetsWasm.load(info.offsets);
  };

  //#endregion

  //#region get grid information
  getMinMax = (onlyData: boolean): JsCoordinate[] | undefined => {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return [
      { x: Number(bounds.min.x), y: Number(bounds.min.y) },
      { x: Number(bounds.max.x), y: Number(bounds.max.y) },
    ];
  };

  getBounds = (onlyData: boolean): Rectangle | undefined => {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return new Rectangle(
      Number(bounds.min.x),
      Number(bounds.min.y),
      Number(bounds.max.x) - Number(bounds.min.x) + 1,
      Number(bounds.max.y) - Number(bounds.min.y) + 1
    );
  };

  //#region Offsets

  // @returns screen position of a cell
  getCellOffsets = (column: number | BigInt, row: number | BigInt): Rectangle => {
    // this check is needed b/c offsets may be in a weird state during hmr
    if (!this.offsets.getCellOffsets) return new Rectangle();

    const screenRect = this.offsets.getCellOffsets(Number(column), Number(row));
    return new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  };

  // @returns the x position of the column
  getColumnX = (x: number): number => {
    return this.offsets.getColumnPlacement(x).position;
  };

  // @returns the y position of the row
  getRowY = (y: number): number => {
    return this.offsets.getRowPlacement(y).position;
  };

  getColumnRow = (x: number, y: number): JsCoordinate => {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    const columnRow: ColumnRow = JSON.parse(columnRowStringified);
    return { x: columnRow.column, y: columnRow.row };
  };

  // @returns screen rectangle for a column/row rectangle
  getScreenRectangle = (
    column: number | BigInt,
    row: number | BigInt,
    width: number | BigInt,
    height: number | BigInt
  ): Rectangle => {
    const topLeft = this.getCellOffsets(Number(column), Number(row));
    const bottomRight = this.getCellOffsets(Number(column) + Number(width), Number(row) + Number(height));
    return new Rectangle(topLeft.left, topLeft.top, bottomRight.left - topLeft.left, bottomRight.top - topLeft.top);
  };

  // @returns screen rectangle from a selection rectangle
  getScreenRectangleFromRectangle = (rect: Rectangle): Rectangle => {
    return this.getScreenRectangle(rect.x, rect.y, rect.width, rect.height);
  };

  updateSheetOffsets = (column: number | null, row: number | null, size: number) => {
    if (column !== null) {
      this.offsets.setColumnWidth(column, size);
    } else if (row !== null) {
      this.offsets.setRowHeight(row, size);
    }
  };

  getColumnFromScreen = (x: number): number => {
    return this.offsets.getColumnFromScreen(x);
  };

  getRowFromScreen = (y: number): number => {
    return this.offsets.getRowFromScreen(y);
  };

  getColumnRowFromScreen = (x: number, y: number): ColumnRow => {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    return JSON.parse(columnRowStringified);
  };

  // @returns the rectangle in cell coordinates from screen coordinates
  getRectangleFromScreen = (rectangle: Rectangle): Rectangle => {
    const start = this.getColumnRowFromScreen(rectangle.x, rectangle.y);
    const end = this.getColumnRowFromScreen(rectangle.right + 1, rectangle.bottom + 1);
    return new Rectangle(start.column, start.row, end.column - start.column + 1, end.row - start.row + 1);
  };

  //#endregion

  getValidationById = (id: string): Validation | undefined => {
    return this.validations.find((v) => v.id === id);
  };

  // Returns the content bounds in viewport coordinates from 0,0 to the
  // bottom-right of the content.
  getScrollbarBounds = (): Rectangle => {
    const bounds = this.bounds;
    if (bounds.type === 'empty') return new Rectangle();
    const bottomRight = this.getCellOffsets(Number(bounds.max.x) + 1, Number(bounds.max.y) + 1);
    return new Rectangle(0, 0, bottomRight.left, bottomRight.top);
  };

  addCheckbox = (): Promise<JsResponse | undefined> => {
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
    return quadraticCore.updateValidation(validation, false);
  };

  hasContent = (col: number, row: number): boolean => {
    return this.contentCache.hasContent(col, row);
  };

  hasContentInRect = (rect: Rectangle): boolean => {
    return this.contentCache.hasContentInRect(rect.x, rect.y, rect.right - 1, rect.bottom - 1);
  };

  getMergeCellsInRect = (rect: Rectangle): Rect[] => {
    return this.mergeCells.getMergeCells(rect.x, rect.y, rect.right - 1, rect.bottom - 1);
  };

  getMergeCellRect = (x: number, y: number): Rect | undefined => {
    return this.mergeCells.getMergeCellRect(x, y) ?? undefined;
  };
}
