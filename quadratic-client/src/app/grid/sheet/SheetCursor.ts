//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { events } from '@/app/events/events';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { A1Selection, CellRefRange, JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import { getTableNameInNameOrColumn, JsSelection } from '@/app/quadratic-core/quadratic_core';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import type { IViewportTransformState } from 'pixi-viewport';
import { Rectangle } from 'pixi.js';

// Select column and/or row for the entire sheet.
export interface ColumnRowCursor {
  columns?: number[];
  rows?: number[];
  all?: true;
}

export interface RectangleLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Save object for the cursor state.
export interface SheetCursorSave {
  sheetId: string;
  keyboardMovePosition: JsCoordinate;
  cursorPosition: JsCoordinate;
  multiCursor?: RectangleLike[];
  columnRow?: ColumnRowCursor;
}

export class SheetCursor {
  sheet: Sheet;

  private _viewport?: IViewportTransformState;

  jsSelection: JsSelection;

  // used to determine if the boxCells (ie, autocomplete) is active
  boxCells: boolean;

  constructor(sheet: Sheet) {
    this.sheet = sheet;
    this.jsSelection = new JsSelection(sheet.id, this.sheet.sheets.a1Context);
    this.boxCells = false;
    events.on('a1Context', this.updateA1Context);
  }

  private updateA1Context = (context: Uint8Array) => {
    this.jsSelection.updateContext(context);
    if (this.sheet.sheets.current === this.sheet.id) {
      pixiApp.cursor.dirty = true;
      events.emit('a1ContextUpdated');
    }
  };

  set viewport(save: IViewportTransformState) {
    this._viewport = save;
  }

  get viewport(): IViewportTransformState {
    if (!this._viewport) {
      const heading = pixiApp.headings.headingSize;
      return { x: heading.width, y: heading.height, scaleX: 1, scaleY: 1 };
    }
    return this._viewport;
  }

  selection(): A1Selection {
    return this.jsSelection.selection();
  }

  save(): string {
    return this.jsSelection.save();
  }

  load(selectionString: string): void {
    this.jsSelection.load(selectionString);
    multiplayer.sendSelection(this.save());
    pixiApp.cursor.dirty = true;
  }

  loadFromSelection(jsSelection: JsSelection, skipMultiplayer = false) {
    this.jsSelection = jsSelection;
    if (!skipMultiplayer) {
      multiplayer.sendSelection(this.save());
    }
    pixiApp.cursor.dirty = true;
  }

  updatePosition(ensureVisible: boolean | JsCoordinate = true) {
    pixiApp.updateCursorPosition(ensureVisible);
    if (!inlineEditorHandler.cursorIsMoving) {
      multiplayer.sendSelection(this.save());
    }
  }

  changeBoxCells(boxCells: boolean) {
    if (boxCells !== this.boxCells) {
      this.boxCells = boxCells;
    }
  }

  // Returns the cursor position.
  get position(): JsCoordinate {
    return this.jsSelection.getCursor();
  }

  // Returns the columns that are selected via ranges [c1_start, c1_end, c2_start, c2_end, ...].
  getSelectedColumnRanges = (from: number, to: number): number[] => {
    return Array.from(this.jsSelection.getSelectedColumnRanges(from, to));
  };

  // Returns the rows that are selected via ranges [r1_start, r1_end, r2_start, r2_end, ...].
  getSelectedRowRanges = (from: number, to: number): number[] => {
    return Array.from(this.jsSelection.getSelectedRowRanges(from, to));
  };

  // Returns the bottom-right cell for the selection.
  get bottomRight(): JsCoordinate {
    return this.jsSelection.getBottomRightCell();
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestRectangle = (): Rectangle => {
    const rect = this.jsSelection.getLargestRectangle();
    return rectToRectangle(rect);
  };

  /// Returns the largest rectangle that contains all the selection, including
  /// unbounded ranges. Converts the BigInt::MAX to Number::MAX.
  getLargestRectangleUnbounded = (): Rectangle => {
    const rect = this.jsSelection.getLargestUnboundedRectangle();
    return new Rectangle(
      Number(rect.min.x),
      Number(rect.min.y),
      rect.max.x > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(rect.max.x),
      rect.max.y > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(rect.max.y)
    );
  };

  // Returns rectangle in case of single finite range selection having more than one cell
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangle = (): Rectangle | undefined => {
    const rect = this.jsSelection.getSingleRectangle();
    return rect ? rectToRectangle(rect) : undefined;
  };

  // Returns rectangle in case of single finite range selection, otherwise returns a rectangle that represents the cursor
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangleOrCursor = (): Rectangle | undefined => {
    const rect = this.jsSelection.getSingleRectangleOrCursor();
    return rect ? rectToRectangle(rect) : undefined;
  };

  overlapsSelection = (a1Selection: string): boolean => {
    return this.jsSelection.overlapsA1Selection(a1Selection);
  };

  /// Returns true if we can insert columns or rows at the selection
  canInsertColumnRow = (): boolean => {
    return this.jsSelection.canInsertColumnRow();
  };

  canInsertColumn = (): boolean => {
    return this.canInsertColumnRow() && this.isSelectedColumnsFinite();
  };

  canInsertRow = (): boolean => {
    return this.canInsertColumnRow() && this.isSelectedRowsFinite();
  };

  // Returns true if the selection is a single cell or a single column or single row.
  hasOneColumnRowSelection = (oneCell?: boolean): boolean => {
    return this.jsSelection.hasOneColumnRowSelection(oneCell ?? false);
  };

  isSelectedColumnsFinite = (): boolean => {
    return this.jsSelection.isSelectedColumnsFinite();
  };

  isSelectedRowsFinite = (): boolean => {
    return this.jsSelection.isSelectedRowsFinite();
  };

  // Returns the columns that are selected.
  getColumnsWithSelectedCells = (): number[] => {
    return Array.from(this.jsSelection.getColumnsWithSelectedCells());
  };

  getSelectedColumns = (): number[] => {
    return Array.from(this.jsSelection.getSelectedColumns());
  };

  getSelectedRows = (): number[] => {
    return Array.from(this.jsSelection.getSelectedRows());
  };

  getSelectedTableColumns = (tableName: string): number[] => {
    return Array.from(this.jsSelection.getTableColumnSelection(tableName));
  };

  // Returns the rows that are selected.
  getRowsWithSelectedCells = (): number[] => {
    return Array.from(this.jsSelection.getRowsWithSelectedCells());
  };

  // Returns true if the cursor is only selecting a single cell
  isSingleSelection = (): boolean => {
    return this.jsSelection.isSingleSelection();
  };

  selectAll = (append?: boolean) => {
    if (this.jsSelection.isAllSelected()) {
      const bounds = this.sheet.boundsWithoutFormatting;
      if (bounds.type === 'nonEmpty') {
        this.jsSelection.selectRect(
          Number(bounds.min.x),
          Number(bounds.min.y),
          Number(bounds.max.x),
          Number(bounds.max.y),
          false
        );
      } else {
        this.jsSelection.selectRect(1, 1, 1, 1, false);
      }
    } else {
      this.jsSelection.selectAll(append ?? false);
    }

    this.updatePosition(true);
  };

  // Moves the cursor to the given position. This replaces any selection.
  moveTo = (
    x: number,
    y: number,
    options?: { checkForTableRef?: boolean; append?: boolean; ensureVisible?: boolean | JsCoordinate }
  ) => {
    const checkForTableRef = options?.checkForTableRef ?? false;
    const append = options?.append ?? false;
    const ensureVisible = options?.ensureVisible ?? true;
    this.jsSelection.moveTo(x, y, append);
    if (checkForTableRef) this.checkForTableRef();
    this.updatePosition(ensureVisible);
  };

  selectTo = (x: number, y: number, append: boolean, ensureVisible = true) => {
    this.jsSelection.selectTo(x, y, append);
    this.updatePosition(ensureVisible ? { x, y } : false);
  };

  // Selects columns that have a current selection (used by cmd+space)
  setColumnsSelected = () => {
    this.jsSelection.setColumnsSelected();
    this.updatePosition(true);
  };

  // Selects rows that have a current selection (used by shift+cmd+space)
  setRowsSelected = () => {
    this.jsSelection.setRowsSelected();
    this.updatePosition(true);
  };

  selectColumn = (column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, top: number) => {
    this.jsSelection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick, top);
    this.updatePosition(true);
  };

  selectRow = (row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, left: number) => {
    this.jsSelection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick, left);
    this.updatePosition(true);
  };

  selectPageDown = () => {
    // todo...
    // let end = this.jsSelection.getBottomRightCell();
    // console.log(end.x, end.y);
    // const bounds = pixiApp.viewport.getVisibleBounds();
    // const y = sheets.sheet.getRowY(end.x);
    // const distanceTopToCursorTop = y - bounds.top;
    // const row = sheets.sheet.getRowFromScreen(y + bounds.height);
    // this.jsSelection.selectTo(end.x, row, false);
    // this.updatePosition(false);
    // const gridHeadings = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
    // pixiApp.viewport.y = Math.min(gridHeadings, -(y + bounds.height) + distanceTopToCursorTop);
    // pixiApp.viewportChanged();
  };

  selectPageUp = () => {
    // todo...
    // const bounds = pixiApp.viewport.getVisibleBounds();
    // this.jsSelection.selectPage(bounds.height, true);
    // this.updatePosition(true);
  };

  isMultiCursor = (): boolean => {
    return this.jsSelection.isMultiCursor();
  };

  isMultiRange = (): boolean => {
    return this.rangeCount() > 1;
  };

  isColumnRow = (): boolean => {
    return this.jsSelection.isColumnRow();
  };

  toA1String = (sheetId = this.sheet.sheets.current): string => {
    return this.jsSelection.toA1String(sheetId);
  };

  toCursorA1 = (): string => {
    return this.jsSelection.toCursorA1();
  };

  contains = (x: number, y: number): boolean => {
    return this.jsSelection.contains(x, y);
  };

  selectRect = (left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) => {
    this.jsSelection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  };

  a1String = (): string => {
    return this.jsSelection.toA1String(this.sheet.id);
  };

  excludeCells = (x0: number, y0: number, x1: number, y1: number, ensureVisible = true) => {
    this.jsSelection.excludeCells(x0, y0, x1, y1);
    this.updatePosition(ensureVisible);
  };

  rangeCount = (): number => {
    return this.getRanges().length;
  };

  getFiniteRefRangeBounds = (): RefRangeBounds[] => {
    let ranges: RefRangeBounds[] = [];
    try {
      ranges = this.jsSelection.getFiniteRefRangeBounds();
    } catch (e) {
      console.warn('Error getting ref range bounds', e);
    }
    return ranges;
  };

  getInfiniteRefRangeBounds = (): RefRangeBounds[] => {
    let ranges: RefRangeBounds[] = [];
    try {
      ranges = this.jsSelection.getInfiniteRefRangeBounds();
    } catch (e) {
      console.error(e);
    }
    return ranges;
  };

  // Checks whether the selection can be converted to a data table
  canConvertToDataTable = (): boolean => {
    return !!this.sheet.cursor.getSingleRectangle();
  };

  // return !tables.intersects(this.multiCursor[0]);
  // getCopyRange(): RefRangeBounds | undefined {
  getRanges = (): CellRefRange[] => {
    const rangesStringified = this.jsSelection.getRanges();
    try {
      return JSON.parse(rangesStringified);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  selectTable = (tableName: string, column: string | undefined, shiftKey: boolean, ctrlKey: boolean) => {
    if (this.sheet.sheets.current !== this.sheet.id) {
      return;
    }
    const bounds = pixiApp.viewport.getVisibleBounds();
    const left = this.sheet.getColumnFromScreen(bounds.left) + 1;
    this.jsSelection.selectTable(tableName, column, left, shiftKey, ctrlKey);
    this.updatePosition(true);
  };

  get selectionEnd(): JsCoordinate {
    return this.jsSelection.bottomRightCell();
  }

  /// Returns true if the cursor is on an html or image cell.
  isOnHtmlImage = (): boolean => {
    return this.jsSelection.cursorIsOnHtmlImage();
  };

  /// Returns the names of the tables that are selected.
  getSelectedTableNames = (): string[] => {
    let names: string[] = [];
    try {
      names = this.jsSelection.getSelectedTableNames();
    } catch (e) {
      console.warn('Error getting selected table names', e);
    }
    return names;
  };

  getTableColumnSelection = (tableName: string): number[] | undefined => {
    let cols: number[] | undefined;
    try {
      cols = this.jsSelection.getTableColumnSelection(tableName);
    } catch (e) {
      console.warn('Error getting table column selection', e);
    }
    return cols;
  };

  getSingleTableSelection(): string | undefined {
    const ranges = this.getRanges();
    if (ranges.length !== 1) {
      return;
    }
    const name = this.getSelectedTableNames();
    if (name.length !== 1) {
      return;
    }
    return name[0];
  }

  getSingleFullTableSelectionName(): string | undefined {
    return this.jsSelection.getSingleFullTableSelectionName();
  }

  getTableNameInNameOrColumn(sheetId: string, x: number, y: number): string | undefined {
    return getTableNameInNameOrColumn(sheetId, x, y, this.sheet.sheets.a1Context);
  }

  updateTableName = (oldName: string, newName: string) => {
    this.jsSelection.updateTableName(oldName, newName);
  };

  updateColumnName = (tableName: string, oldName: string, newName: string) => {
    this.jsSelection.updateColumnName(tableName, oldName, newName);
  };

  hideColumn = (tableName: string, columnName: string) => {
    this.jsSelection.hideColumn(tableName, columnName);
    const { x, y } = this.position;
    this.selectRect(x, y, x, y);
  };

  isEntireColumnSelected = (column: number): boolean => {
    return this.jsSelection.isEntireColumnSelected(column);
  };

  isEntireRowSelected = (row: number): boolean => {
    return this.jsSelection.isEntireRowSelected(row);
  };

  checkForTableRef = () => {
    this.jsSelection.checkForTableRef(this.sheet.id);
  };

  getContiguousColumns = (): number[] | undefined => {
    const response = this.jsSelection.getContiguousColumns();
    if (response) {
      return Array.from(response);
    }
  };

  getContiguousRows = (): number[] | undefined => {
    const response = this.jsSelection.getContiguousRows();
    if (response) {
      return Array.from(response);
    }
  };

  isTableColumnSelected = (tableName: string, column: number): boolean => {
    return this.jsSelection.isTableColumnSelected(tableName, column);
  };

  getSelectedTableColumnsCount = (): number => {
    return this.jsSelection.getSelectedTableColumnsCount();
  };

  isAllSelected = (): boolean => {
    return this.jsSelection.isAllSelected();
  };
}
