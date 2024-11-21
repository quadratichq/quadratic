//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Selection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { IViewportTransformState } from 'pixi-viewport';
import { Rectangle } from 'pixi.js';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { Sheet } from './Sheet';

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
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor?: RectangleLike[];
  columnRow?: ColumnRowCursor;
}

export class SheetCursor {
  private _viewport?: IViewportTransformState;

  selection: Selection;

  // used to determine if the boxCells (ie, autocomplete) is active
  boxCells: boolean;

  constructor(sheet: Sheet) {
    this.selection = new Selection(sheet.id);
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
    return this.selection.save();
  }

  load(selection: string): void {
    this.selection = Selection.load(selection);
    multiplayer.sendSelection(this.save());
    pixiApp.cursor.dirty = true;
  }

  loadFromSelection(selection: Selection, skipMultiplayer = false) {
    this.selection = selection;
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

  get position(): Coordinate {
    return this.selection.getCursor();
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestRectangle(): Rectangle {
    const rect = this.selection.getLargestRectangle();
    return rectToRectangle(rect);
  }

  // Returns rectangle in case of single range selection having more than one cell
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangle(): Rectangle | undefined {
    const rect = this.selection.getSingleRectangle();
    return rect ? rectToRectangle(rect) : undefined;
  }

  // Returns rectangle in case of single range selection, otherwise returns a rectangle that represents the cursor
  // Returns undefined if there are multiple ranges or infinite range selection
  getSingleRectangleOrCursor(): Rectangle | undefined {
    const rect = this.selection.getSingleRectangleOrCursor();
    return rect ? rectToRectangle(rect) : undefined;
  }

  overlapsSelection(a1Selection: string): boolean {
    return this.selection.overlapsA1Selection(a1Selection);
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
    this.selection.selectAll();
    this.updatePosition(true);
  }

  selectDeltaSize(deltaX: number, deltaY: number) {
    this.selection.deltaSize(deltaX, deltaY);
    this.updatePosition(true);
  }

  moveTo(x: number, y: number, ensureVisible = true) {
    this.selection.moveTo(x, y);
    this.updatePosition(ensureVisible);
  }

  // Returns all columns that have a selection (used by cmd+space)
  setColumnsSelected() {
    this.selection.setColumnsSelected();
    this.updatePosition(true);
  }

  setRowsSelected() {
    this.selection.setRowsSelected();
    this.updatePosition(true);
  }

  selectColumn(column: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean) {
    this.selection.selectColumn(column, ctrlKey || shiftKey, shiftKey, isRightClick);
    this.updatePosition(true);
  }

  selectRow(row: number, ctrlKey: boolean, shiftKey: boolean, isRightClick: boolean) {
    this.selection.selectRow(row, ctrlKey || shiftKey, shiftKey, isRightClick);
    this.updatePosition(true);
  }

  selectColumns(column: number, append: boolean) {
    this.selection.selectColumn(column, append);
    this.updatePosition(true);
  }

  selectRows(row: number[], startRow?: number) {
    throw new Error('TODO selectRows');
  }

  isMultiCursor(): boolean {
    return this.selection.isMultiCursor();
  }

  isColumnRow(): boolean {
    return this.selection.isColumnRow();
  }

  toA1String(sheetId = sheets.sheet.id): string {
    return this.selection.toString(sheetId, sheets.getRustSheetMap());
  }

  contains(x: number, y: number): boolean {
    return this.selection.contains(x, y);
  }

  selectRect(left: number, top: number, right: number, bottom: number, append = false, ensureVisible = true) {
    this.selection.selectRect(left, top, right, bottom, append);
    this.updatePosition(ensureVisible);
  }

  extendSelection(column: number, row: number, append: boolean) {
    this.selection.extendSelection(column, row, append);
    this.updatePosition(true);
  }
}
