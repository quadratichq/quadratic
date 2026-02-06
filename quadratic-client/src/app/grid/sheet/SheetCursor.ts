//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { events } from '@/app/events/events';
import type { Sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { animateViewport, calculatePageUpDown, isAnimating } from '@/app/gridGL/interaction/viewportHelper';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import type { A1Selection, CellRefRange, JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import type { Direction } from '@/app/quadratic-core/quadratic_core';
import { JsSelection } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
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
    this.jsSelection = new JsSelection(sheet.id);
    this.boxCells = false;
  }

  set viewport(save: IViewportTransformState) {
    this._viewport = save;
  }

  get viewport(): IViewportTransformState {
    if (!this._viewport) {
      const heading = content.headings.headingSize;
      return { x: heading.width, y: heading.height, scaleX: 1, scaleY: 1 };
    }
    return this._viewport;
  }

  get sheets(): Sheets {
    return this.sheet.sheets;
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
    events.emit('setDirty', { cursor: true });
  }

  loadFromSelection(jsSelection: JsSelection, skipMultiplayer = false) {
    this.jsSelection.free();
    this.jsSelection = jsSelection;
    if (!skipMultiplayer) {
      multiplayer.sendSelection(this.save());
    }
    events.emit('setDirty', { cursor: true });
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
    return Array.from(this.jsSelection.getSelectedColumnRanges(from, to, this.sheets.jsA1Context));
  };

  // Returns the rows that are selected via ranges [r1_start, r1_end, r2_start, r2_end, ...].
  getSelectedRowRanges = (from: number, to: number): number[] => {
    return Array.from(this.jsSelection.getSelectedRowRanges(from, to, this.sheets.jsA1Context));
  };

  // Returns the bottom-right cell for the selection.
  get bottomRight(): JsCoordinate {
    return this.jsSelection.getBottomRightCell();
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestRectangle = (): Rectangle => {
    const rect = this.jsSelection.getLargestRectangle(this.sheets.jsA1Context);
    return rectToRectangle(rect);
  };

  /// Returns the largest rectangle that contains all the selection, including
  /// unbounded ranges. Converts the BigInt::MAX to Number::MAX.
  getLargestRectangleUnbounded = (): Rectangle => {
    const rect = this.jsSelection.getLargestUnboundedRectangle(this.sheets.jsA1Context);
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
    const rect = this.jsSelection.getSingleRectangle(this.sheets.jsA1Context);
    return rect ? rectToRectangle(rect) : undefined;
  };

  // Returns rectangle in case of single finite range selection, otherwise returns a rectangle that represents the cursor
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangleOrCursor = (): Rectangle | undefined => {
    const rect = this.jsSelection.getSingleRectangleOrCursor(this.sheets.jsA1Context);
    return rect ? rectToRectangle(rect) : undefined;
  };

  overlapsSelection = (a1Selection: string): boolean => {
    return this.jsSelection.overlapsA1Selection(a1Selection, this.sheets.jsA1Context);
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
    return this.jsSelection.hasOneColumnRowSelection(oneCell ?? false, this.sheets.jsA1Context);
  };

  isSelectedColumnsFinite = (): boolean => {
    return this.jsSelection.isSelectedColumnsFinite(this.sheets.jsA1Context);
  };

  isSelectedRowsFinite = (): boolean => {
    return this.jsSelection.isSelectedRowsFinite(this.sheets.jsA1Context);
  };

  // Returns the columns that are selected.
  getColumnsWithSelectedCells = (): number[] => {
    return Array.from(this.jsSelection.getColumnsWithSelectedCells(this.sheets.jsA1Context));
  };

  getSelectedColumns = (): number[] => {
    return Array.from(this.jsSelection.getSelectedColumns());
  };

  getSelectedRows = (): number[] => {
    return Array.from(this.jsSelection.getSelectedRows());
  };

  getSelectedTableColumns = (tableName: string): number[] => {
    return Array.from(this.jsSelection.getTableColumnSelection(tableName, this.sheets.jsA1Context));
  };

  // Returns the rows that are selected.
  getRowsWithSelectedCells = (): number[] => {
    return Array.from(this.jsSelection.getRowsWithSelectedCells(this.sheets.jsA1Context));
  };

  // Returns true if the cursor is only selecting a single cell
  isSingleSelection = (): boolean => {
    return this.jsSelection.isSingleSelection(this.sheets.jsA1Context);
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
    this.jsSelection.moveTo(x, y, append, this.sheets.sheet.mergeCells);
    if (checkForTableRef) this.checkForTableRef();
    this.updatePosition(ensureVisible);
  };

  /// Keyboard selection by deltaX and deltaY
  keyboardSelectTo = (deltaX: number, deltaY: number) => {
    this.jsSelection.keyboardSelectTo(deltaX, deltaY, this.sheets.jsA1Context, this.sheets.sheet.mergeCells);
    this.updatePosition(true);
  };

  keyboardJumpSelectTo = (col: number, row: number, direction: Direction) => {
    this.jsSelection.keyboardJumpSelectTo(col, row, direction, this.sheets.jsA1Context, this.sheets.sheet.mergeCells);
    this.updatePosition(true);
  };

  selectTo = (x: number, y: number, append: boolean, ensureVisible = true) => {
    this.jsSelection.selectTo(x, y, append, this.sheets.jsA1Context, this.sheets.sheet.mergeCells);
    this.updatePosition(ensureVisible ? { x, y } : false);
  };

  // Selects columns that have a current selection (used by cmd+space)
  setColumnsSelected = () => {
    this.jsSelection.setColumnsSelected(this.sheets.jsA1Context);
    this.updatePosition(true);
  };

  // Selects rows that have a current selection (used by shift+cmd+space)
  setRowsSelected = () => {
    this.jsSelection.setRowsSelected(this.sheets.jsA1Context);
    this.updatePosition(true);
  };

  selectColumn = (column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, top: number) => {
    this.jsSelection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick, top, this.sheets.jsA1Context);
    this.updatePosition(true);
  };

  selectRow = (row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, left: number) => {
    this.jsSelection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick, left, this.sheets.jsA1Context);
    this.updatePosition(true);
  };

  selectPageDown = () => {
    if (isAnimating()) return;
    const { x, y, row } = calculatePageUpDown(false, true);
    const column = this.selectionEnd.x;
    this.selectTo(column, row, false, false);
    animateViewport({ x: -x, y: -y });
  };

  selectPageUp = () => {
    if (isAnimating()) return;
    const { x, y, row } = calculatePageUpDown(true, true);
    const column = this.selectionEnd.x;
    this.selectTo(column, row, false, false);
    animateViewport({ x: -x, y: -y });
  };

  isMultiCursor = (): boolean => {
    return this.jsSelection.isMultiCursor(this.sheets.jsA1Context);
  };

  isMultiRange = (): boolean => {
    return this.rangeCount() > 1;
  };

  isColumnRow = (): boolean => {
    return this.jsSelection.isColumnRow();
  };

  toA1String = (sheetId = this.sheet.sheets.current): string => {
    // If it's a single cell selection and that cell is part of a merged cell,
    // show the anchor cell location instead
    if (this.isSingleSelection()) {
      const mergeRect = this.sheet.getMergeCellRect(this.position.x, this.position.y);
      if (mergeRect) {
        // Use the anchor position (top-left of merged cell)
        const anchorX = Number(mergeRect.min.x);
        const anchorY = Number(mergeRect.min.y);
        return getA1Notation(anchorX, anchorY);
      }
    }
    return this.jsSelection.toA1String(sheetId, this.sheets.jsA1Context);
  };

  toCursorA1 = (): string => {
    return this.jsSelection.toCursorA1();
  };

  contains = (x: number, y: number): boolean => {
    return this.jsSelection.contains(x, y, this.sheets.jsA1Context);
  };

  selectRect = (left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) => {
    this.jsSelection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  };

  a1String = (): string => {
    return this.jsSelection.toA1String(this.sheet.id, this.sheets.jsA1Context);
  };

  excludeCells = (x0: number, y0: number, x1: number, y1: number, ensureVisible = true) => {
    this.jsSelection.excludeCells(x0, y0, x1, y1, this.sheets.jsA1Context);
    this.updatePosition(ensureVisible);
  };

  rangeCount = (): number => {
    return this.getRanges().length;
  };

  getFiniteRefRangeBounds = (): RefRangeBounds[] => {
    let ranges: RefRangeBounds[] = [];
    try {
      ranges = this.jsSelection.getFiniteRefRangeBounds(this.sheets.jsA1Context, this.sheet.mergeCells);
    } catch (e) {
      console.warn('Error getting ref range bounds', e);
    }
    return ranges;
  };

  containsMergedCells = (): boolean => {
    try {
      return this.jsSelection.containsMergedCells(this.sheets.jsA1Context, this.sheet.mergeCells);
    } catch (e) {
      console.warn('Error checking merged cells', e);
      return false;
    }
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
    const rectangle = this.sheet.cursor.getSingleRectangle();
    if (!rectangle) return false;
    return !content.cellsSheet.tables.hasCodeCellInRect(rectangle);
  };

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
    this.jsSelection.selectTable(tableName, column, left, shiftKey, ctrlKey, this.sheets.jsA1Context);
    this.updatePosition(true);
  };

  get selectionEnd(): JsCoordinate {
    return this.jsSelection.selectionEnd(this.sheets.jsA1Context);
  }

  /// Returns true if the cursor is on an html or image cell.
  isOnHtmlImage = (): boolean => {
    return this.jsSelection.cursorIsOnHtmlImage(this.sheets.jsA1Context);
  };

  /// Returns a collection of Rectangles that represent sheet ranges in the
  /// selection.
  private getSheetRefRangeBounds(): Rectangle[] {
    const rangeBounds = this.jsSelection.getSheetRefRangeBounds();
    return rangeBounds.map((range: RefRangeBounds) => {
      const startX =
        range.start.col.coord > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(range.start.col.coord);
      const startY =
        range.start.row.coord > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(range.start.row.coord);
      const endX =
        range.end.col.coord > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(range.end.col.coord);
      const endY =
        range.end.row.coord > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(range.end.row.coord);
      return new Rectangle(startX, startY, endX - startX + 1, endY - startY + 1);
    });
  }

  private selectedTableNamesFromTableSelection(): string[] {
    const cache = this.sheet.dataTablesCache;
    if (!cache) return [];
    return this.jsSelection.getSelectedTableNames(this.sheets.current, cache, this.sheets.jsA1Context) as string[];
  }

  /// Returns the names of the tables that are selected.
  getSelectedTableNames = (): string[] => {
    const names = new Set<string>();
    try {
      this.selectedTableNamesFromTableSelection().forEach((name) => names.add(name));
      const rects = this.getSheetRefRangeBounds();
      rects.forEach((rect) => {
        const tables = content.cellsSheet.tables.getTablesInRect(rect);
        tables.forEach((table) => {
          if (table.codeCell.show_name && table.codeCell.y >= rect.y && table.codeCell.y <= rect.bottom - 1) {
            names.add(table.codeCell.name);
          }
        });
      });
    } catch (e) {
      console.warn('Error getting selected table names', e);
    }
    return Array.from(names);
  };

  getTablesWithColumnSelection = (): string[] => {
    return this.jsSelection.getTablesWithColumnSelection();
  };

  getTableColumnSelection = (tableName: string): number[] | undefined => {
    let cols: number[] | undefined;
    try {
      cols = this.jsSelection.getTableColumnSelection(tableName, this.sheets.jsA1Context);
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

  updateTableName = (oldName: string, newName: string) => {
    this.jsSelection.updateTableName(oldName, newName);
  };

  updateColumnName = (tableName: string, oldName: string, newName: string) => {
    this.jsSelection.updateColumnName(tableName, oldName, newName);
  };

  isEntireColumnSelected = (column: number): boolean => {
    return this.jsSelection.isEntireColumnSelected(column);
  };

  isEntireRowSelected = (row: number): boolean => {
    return this.jsSelection.isEntireRowSelected(row);
  };

  checkForTableRef = () => {
    this.jsSelection.checkForTableRef(this.sheet.id, this.sheets.jsA1Context);
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
    return this.jsSelection.isTableColumnSelected(tableName, column, this.sheets.jsA1Context);
  };

  getSelectedTableColumnsCount = (): number => {
    return this.jsSelection.getSelectedTableColumnsCount(this.sheets.jsA1Context);
  };

  isAllSelected = (): boolean => {
    return this.jsSelection.isAllSelected();
  };

  getTableNameFromPos = (codeCell: CodeCell): string | undefined => {
    return this.jsSelection.getTableNameFromPos(
      codeCell.sheetId,
      codeCell.pos.x,
      codeCell.pos.y,
      this.sheets.jsA1Context
    );
  };

  is1dRange = (): boolean => {
    return this.jsSelection.is1dRange(this.sheets.jsA1Context);
  };
}
