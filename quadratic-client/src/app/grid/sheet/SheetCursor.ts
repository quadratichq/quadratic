//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { JsCoordinate } from '@/app/quadratic-core-types';
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

  save(): string {
    return this.jsSelection.save();
  }

  load(jsSelectionString: string): void {
    this.jsSelection = JsSelection.load(jsSelectionString);
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

  get position(): JsCoordinate {
    return this.jsSelection.getCursor();
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

  hasOneColumnRowSelection(oneCell?: boolean): boolean {
    throw new Error('TODO hasOneColumnRowSelection');
    // return (
    //   !this.columnRow?.all &&
    //   !!(
    //     (this.columnRow?.columns && this.columnRow.columns.length === 1) ||
    //     (this.columnRow?.rows && this.columnRow.rows.length === 1) ||
    //     (oneCell && !this.multiCursor)
    //   )
    // );
  }

  // Returns the columns that are selected.
  getColumnsSelection(): number[] {
    throw new Error('TODO getColumnsSelection');
    // const columns = new Set<number>();
    // if (this.columnRow?.columns) {
    //   this.columnRow.columns.forEach((column) => columns.add(column));
    // }
    // if (this.multiCursor) {
    //   for (const rect of this.multiCursor) {
    //     columns.add(rect.x);
    //   }
    // }
    // columns.add(this.cursorPosition.x);
    // return Array.from(columns);
  }

  // Returns the rows that are selected.
  getRowsSelection(): number[] {
    throw new Error('TODO getRowsSelection');
    // const rows = new Set<number>();
    // if (this.columnRow?.rows) {
    //   this.columnRow.rows.forEach((row) => rows.add(row));
    // }
    // if (this.multiCursor) {
    //   for (const rect of this.multiCursor) {
    //     rows.add(rect.y);
    //   }
    // }
    // rows.add(this.cursorPosition.y);
    // return Array.from(rows);
  }

  // Returns true if the cursor is only selecting a single cell
  onlySingleSelection(): boolean {
    throw new Error('TODO onlySingleSelection');
    // return !this.multiCursor?.length && !this.columnRow;
  }

  selectAll() {
    this.jsSelection.selectAll();
    this.updatePosition(true);
  }

  selectDeltaSize(deltaX: number, deltaY: number) {
    this.jsSelection.deltaSize(deltaX, deltaY);
    this.updatePosition(true);
  }

  moveTo(x: number, y: number, ensureVisible = true) {
    this.jsSelection.moveTo(x, y);
    this.updatePosition(ensureVisible);
  }

  // Returns all columns that have a selection (used by cmd+space)
  setColumnsSelected() {
    this.jsSelection.setColumnsSelected();
    this.updatePosition(true);
  }

  setRowsSelected() {
    this.jsSelection.setRowsSelected();
    this.updatePosition(true);
  }

  selectColumn(column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean, top: number) {
    this.jsSelection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick, top);
    this.updatePosition(true);
  }

  selectRow(row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean) {
    this.jsSelection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick);
    this.updatePosition(true);
  }

  isMultiCursor(): boolean {
    return this.jsSelection.isMultiCursor();
  }

  isColumnRow(): boolean {
    return this.jsSelection.isColumnRow();
  }

  toA1String(sheetId = sheets.current): string {
    return this.jsSelection.toA1String(sheetId, sheets.getRustSheetMap());
  }

  toCursorA1String(): string {
    return this.jsSelection.toCursorA1String();
  }

  contains(x: number, y: number): boolean {
    return this.jsSelection.contains(x, y);
  }

  selectRect(left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) {
    this.jsSelection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  }

  extendSelection(column: number, row: number, append: boolean) {
    this.jsSelection.extendSelection(column, row, append);
    this.updatePosition(true);
  }
}
