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
    this.jsSelection = JsSelection.load(selectionString);
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

  // Returns the last selection's end cell.
  get selectionEnd(): JsCoordinate {
    return this.jsSelection.getSelectionEnd();
  }

  // Returns the columns that are selected via ranges [c1_start, c1_end, c2_start, c2_end, ...].
  getSelectedColumnRanges(from: number, to: number): number[] {
    return Array.from(this.jsSelection.getSelectedColumnRanges(from, to));
  }

  // Returns the rows that are selected via ranges [r1_start, r1_end, r2_start, r2_end, ...].
  getSelectedRowRanges(from: number, to: number): number[] {
    return Array.from(this.jsSelection.getSelectedRowRanges(from, to));
  }

  // Returns the bottom-right cell for the selection.
  get bottomRight(): JsCoordinate {
    return this.jsSelection.getBottomRightCell();
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestRectangle(): Rectangle {
    const rect = this.jsSelection.getLargestRectangle();
    return rectToRectangle(rect);
  }

  // Returns rectangle in case of single finite range selection having more than one cell
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangle(): Rectangle | undefined {
    const rect = this.jsSelection.getSingleRectangle();
    return rect ? rectToRectangle(rect) : undefined;
  }

  // Returns rectangle in case of single finite range selection, otherwise returns a rectangle that represents the cursor
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangleOrCursor(): Rectangle | undefined {
    const rect = this.jsSelection.getSingleRectangleOrCursor();
    return rect ? rectToRectangle(rect) : undefined;
  }

  overlapsSelection(a1Selection: string): boolean {
    return this.jsSelection.overlapsA1Selection(a1Selection);
  }

  // Returns true if the selection is a single cell or a single column or single row.
  hasOneColumnRowSelection(oneCell?: boolean): boolean {
    return this.jsSelection.hasOneColumnRowSelection(oneCell ?? false);
  }

  isSelectedColumnsFinite(): boolean {
    return this.jsSelection.isSelectedColumnsFinite();
  }

  isSelectedRowsFinite(): boolean {
    return this.jsSelection.isSelectedRowsFinite();
  }

  // Returns the columns that are selected.
  getSelectedColumns(): number[] {
    return Array.from(this.jsSelection.getSelectedColumns());
  }

  // Returns the rows that are selected.
  getSelectedRows(): number[] {
    return Array.from(this.jsSelection.getSelectedRows());
  }

  // Returns true if the cursor is only selecting a single cell
  isSingleSelection(): boolean {
    return this.jsSelection.isSingleSelection();
  }

  selectAll(append?: boolean) {
    this.jsSelection.selectAll(append ?? false);
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
    this.jsSelection.setColumnsSelected();
    this.updatePosition(true);
  }

  // Selects rows that have a current selection (used by shift+cmd+space)
  setRowsSelected() {
    this.jsSelection.setRowsSelected();
    this.updatePosition(true);
  }

  selectColumn(column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, top: number) {
    this.jsSelection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick, top);
    this.updatePosition(true);
  }

  selectRow(row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, left: number) {
    this.jsSelection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick, left);
    this.updatePosition(true);
  }

  isMultiCursor(): boolean {
    return this.jsSelection.isMultiCursor();
  }

  isMultiRange(): boolean {
    return this.rangeCount() > 1;
  }

  isColumnRow(): boolean {
    return this.jsSelection.isColumnRow();
  }

  toA1String(sheetId = sheets.current): string {
    return this.jsSelection.toA1String(sheetId, sheets.getSheetIdNameMap());
  }

  toCursorA1(): string {
    return this.jsSelection.toCursorA1();
  }

  contains(x: number, y: number): boolean {
    return this.jsSelection.contains(x, y);
  }

  selectRect(left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) {
    this.jsSelection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  }

  a1String(): string {
    return this.jsSelection.toA1String(sheets.sheet.id, sheets.getSheetIdNameMap());
  }

  excludeCells(x0: number, y0: number, x1: number, y1: number, ensureVisible = true) {
    this.jsSelection.excludeCells(x0, y0, x1, y1);
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
}
