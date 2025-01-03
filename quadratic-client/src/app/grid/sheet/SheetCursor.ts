//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { A1Selection, CellRefRange, JsCoordinate } from '@/app/quadratic-core-types';
import { JsSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { IViewportTransformState } from 'pixi-viewport';
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
  private _viewport?: IViewportTransformState;

  jsSelection: JsSelection;

  // used to determine if the boxCells (ie, autocomplete) is active
  boxCells: boolean;

  constructor(sheet: Sheet) {
    this.jsSelection = new JsSelection(sheet.id);
    this.boxCells = false;
  }

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

  updatePosition(ensureVisible = true) {
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
  getSelectedColumnRanges(from: number, to: number): number[] {
    return Array.from(this.jsSelection.getSelectedColumnRanges(from, to, sheets.a1Context));
  }

  // Returns the rows that are selected via ranges [r1_start, r1_end, r2_start, r2_end, ...].
  getSelectedRowRanges(from: number, to: number): number[] {
    return Array.from(this.jsSelection.getSelectedRowRanges(from, to, sheets.a1Context));
  }

  // Returns the bottom-right cell for the selection.
  get bottomRight(): JsCoordinate {
    return this.jsSelection.getBottomRightCell();
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestRectangle(): Rectangle {
    const rect = this.jsSelection.getLargestRectangle(sheets.a1Context);
    return rectToRectangle(rect);
  }

  // Returns rectangle in case of single finite range selection having more than one cell
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangle(): Rectangle | undefined {
    const rect = this.jsSelection.getSingleRectangle(sheets.a1Context);
    return rect ? rectToRectangle(rect) : undefined;
  }

  // Returns rectangle in case of single finite range selection, otherwise returns a rectangle that represents the cursor
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangleOrCursor(): Rectangle | undefined {
    const rect = this.jsSelection.getSingleRectangleOrCursor(sheets.a1Context);
    return rect ? rectToRectangle(rect) : undefined;
  }

  overlapsSelection(a1Selection: string): boolean {
    return this.jsSelection.overlapsA1Selection(a1Selection, sheets.a1Context);
  }

  // Returns true if the selection is a single cell or a single column or single row.
  hasOneColumnRowSelection(oneCell?: boolean): boolean {
    return this.jsSelection.hasOneColumnRowSelection(oneCell ?? false);
  }

  isSelectedColumnsFinite(): boolean {
    return this.jsSelection.isSelectedColumnsFinite(sheets.a1Context);
  }

  isSelectedRowsFinite(): boolean {
    return this.jsSelection.isSelectedRowsFinite(sheets.a1Context);
  }

  // Returns the columns that are selected.
  getSelectedColumns(): number[] {
    return Array.from(this.jsSelection.getSelectedColumns(sheets.a1Context));
  }

  // Returns the rows that are selected.
  getSelectedRows(): number[] {
    return Array.from(this.jsSelection.getSelectedRows(sheets.a1Context));
  }

  // Returns true if the cursor is only selecting a single cell
  isSingleSelection(): boolean {
    return this.jsSelection.isSingleSelection();
  }

  selectAll(append?: boolean) {
    if (this.jsSelection.isAllSelected()) {
      const bounds = sheets.sheet.boundsWithoutFormatting;
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
  }

  // Moves the cursor to the given position. This replaces any selection.
  moveTo(x: number, y: number, append = false, ensureVisible = true) {
    this.jsSelection.moveTo(x, y, append);
    this.updatePosition(ensureVisible);
  }

  selectTo(x: number, y: number, append: boolean, ensureVisible = true) {
    this.jsSelection.selectTo(x, y, append);
    this.updatePosition(ensureVisible);
  }

  // Selects columns that have a current selection (used by cmd+space)
  setColumnsSelected() {
    this.jsSelection.setColumnsSelected(sheets.a1Context);
    this.updatePosition(true);
  }

  // Selects rows that have a current selection (used by shift+cmd+space)
  setRowsSelected() {
    this.jsSelection.setRowsSelected(sheets.a1Context);
    this.updatePosition(true);
  }

  selectColumn(column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, top: number) {
    this.jsSelection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick, top, sheets.a1Context);
    this.updatePosition(true);
  }

  selectRow(row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, left: number) {
    this.jsSelection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick, left, sheets.a1Context);
    this.updatePosition(true);
  }

  isMultiCursor(): boolean {
    return this.jsSelection.isMultiCursor(sheets.a1Context);
  }

  isMultiRange(): boolean {
    return this.rangeCount() > 1;
  }

  isColumnRow(): boolean {
    return this.jsSelection.isColumnRow();
  }

  toA1String(sheetId = sheets.current): string {
    return this.jsSelection.toA1String(sheetId, sheets.a1Context);
  }

  toCursorA1(): string {
    return this.jsSelection.toCursorA1();
  }

  contains(x: number, y: number): boolean {
    return this.jsSelection.contains(x, y, sheets.a1Context);
  }

  selectRect(left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) {
    this.jsSelection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  }

  a1String(): string {
    return this.jsSelection.toA1String(sheets.sheet.id, sheets.a1Context);
  }

  excludeCells(x0: number, y0: number, x1: number, y1: number, ensureVisible = true) {
    this.jsSelection.excludeCells(x0, y0, x1, y1, sheets.a1Context);
    this.updatePosition(ensureVisible);
  }

  rangeCount(): number {
    return this.getFiniteRanges().length + this.getInfiniteRanges().length;
  }

  getFiniteRanges(): CellRefRange[] {
    const ranges = this.jsSelection.getFiniteRanges();
    try {
      return JSON.parse(ranges);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  getInfiniteRanges(): CellRefRange[] {
    const ranges = this.jsSelection.getInfiniteRanges();
    try {
      return JSON.parse(ranges);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // Returns true if there is one multiselect of > 1 size
  canConvertToDataTable(): boolean {
    const tables = pixiApp.cellsSheets.current?.tables;
    if (!tables) return false;
    return !!sheets.sheet.cursor.getSingleRectangle();
  }

  // return !tables.intersects(this.multiCursor[0]);
  // getCopyRange(): RefRangeBounds | undefined {
  getRanges(): CellRefRange[] {
    const rangesStringified = this.jsSelection.getRanges();
    try {
      return JSON.parse(rangesStringified);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  selectTable(table: string, column: string | undefined, append: boolean) {
    this.jsSelection.selectTable(table, column, append);
  }

  get selectionEnd(): JsCoordinate {
    return this.jsSelection.bottomRightCell(sheets.a1Context);
  }
}
