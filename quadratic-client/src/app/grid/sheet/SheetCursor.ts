//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Rect, Selection } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { IViewportTransformState } from 'pixi-viewport';
import { Rectangle } from 'pixi.js';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { Sheet } from './Sheet';
import { selectionOverlapsSelection } from './sheetCursorUtils';

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

  sheetId: string;

  // used to determine if the boxCells (ie, autocomplete) is active
  boxCells: boolean;

  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor?: Rectangle[];
  columnRow?: ColumnRowCursor;

  constructor(sheet: Sheet) {
    this.sheetId = sheet.id;
    this.boxCells = false;
    this.keyboardMovePosition = { x: 0, y: 0 };
    this.cursorPosition = { x: 0, y: 0 };
  }

  set viewport(save: IViewportTransformState) {
    this._viewport = save;
  }
  get viewport(): IViewportTransformState {
    if (!this._viewport) {
      const { x, y } = pixiApp.getStartingViewport();
      return { x, y, scaleX: 1, scaleY: 1 };
    }
    return this._viewport;
  }

  save(): SheetCursorSave {
    return {
      sheetId: this.sheetId,
      keyboardMovePosition: this.keyboardMovePosition,
      cursorPosition: this.cursorPosition,
      multiCursor: this.multiCursor?.map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
      columnRow: this.columnRow,
    };
  }

  load(value: SheetCursorSave): void {
    this.keyboardMovePosition = value.keyboardMovePosition;
    this.cursorPosition = value.cursorPosition;
    this.multiCursor = value.multiCursor?.map((rect) => new Rectangle(rect.x, rect.y, rect.width, rect.height));
    this.columnRow = value.columnRow;
    multiplayer.sendSelection(this.getMultiplayerSelection());
    pixiApp.cursor.dirty = true;
  }

  loadFromSelection(selection: Selection, skipMultiplayer = false) {
    this.cursorPosition = { x: Number(selection.x), y: Number(selection.y) };

    if (
      selection.rects?.length === 1 &&
      selection.rects[0].min.x === selection.rects[0].max.x &&
      selection.rects[0].min.y === selection.rects[0].max.y
    ) {
      // This is a single cell selection
      this.multiCursor = undefined;
    } else {
      this.multiCursor = selection.rects?.map(
        (rect) =>
          new Rectangle(
            Number(rect.min.x),
            Number(rect.min.y),
            Number(rect.max.x) - Number(rect.min.x) + 1,
            Number(rect.max.y) - Number(rect.min.y) + 1
          )
      );
    }

    if (selection.columns === null && selection.rows === null && selection.all === false) {
      this.columnRow = undefined;
    } else {
      this.columnRow = {
        columns: selection.columns?.map((x) => Number(x)),
        rows: selection.rows?.map((y) => Number(y)),
        all: selection.all === true ? true : undefined,
      };
    }

    if (!skipMultiplayer) {
      multiplayer.sendSelection(this.getMultiplayerSelection());
    }
    pixiApp.cursor.dirty = true;
  }

  // Changes the cursor position. If multiCursor or columnRow is set to null,
  // then it will be cleared.
  changePosition(
    options: {
      multiCursor?: Rectangle[] | null;
      columnRow?: ColumnRowCursor | null;
      cursorPosition?: Coordinate;
      keyboardMovePosition?: Coordinate;
      ensureVisible?: boolean | Coordinate;
    },
    test?: boolean
  ) {
    if (options.columnRow) {
      this.columnRow = options.columnRow;
    } else if (options.columnRow === null) {
      this.columnRow = undefined;
    }

    if (options.multiCursor) {
      this.multiCursor = options.multiCursor;
    } else if (options.multiCursor === null) {
      this.multiCursor = undefined;
    }

    if (options.cursorPosition) {
      this.cursorPosition = options.cursorPosition;
      this.keyboardMovePosition = options.keyboardMovePosition ?? this.cursorPosition;
    } else if (options.keyboardMovePosition) {
      this.keyboardMovePosition = options.keyboardMovePosition;
    }
    if (!test) {
      pixiApp.updateCursorPosition(options.ensureVisible ?? true);
      if (!inlineEditorHandler.cursorIsMoving) {
        multiplayer.sendSelection(this.getMultiplayerSelection());
      }
    }
  }

  // gets a stringified selection string for multiplayer
  getMultiplayerSelection(): string {
    return JSON.stringify({
      cursorPosition: this.cursorPosition,
      multiCursor: this.multiCursor,
      columnRow: this.columnRow,
    });
  }

  changeBoxCells(boxCells: boolean) {
    if (boxCells !== this.boxCells) {
      this.boxCells = boxCells;
    }
  }

  getCursor(): Coordinate {
    return this.cursorPosition;
  }

  // Gets all cursor Rectangles (either multiCursor or single cursor)
  getRectangles(): Rectangle[] {
    if (this.multiCursor) {
      return this.multiCursor;
    } else {
      return [new Rectangle(this.cursorPosition.x, this.cursorPosition.y, 1, 1)];
    }
  }

  getRustSelection(): Selection {
    const sheet_id = { id: this.sheetId };
    const columns = this.columnRow?.columns ? this.columnRow.columns.map((x) => BigInt(x)) : null;
    const rows = this.columnRow?.rows ? this.columnRow.rows.map((y) => BigInt(y)) : null;
    const all = this.columnRow?.all ?? false;
    let rects: Rect[] | null = null;
    if (this.multiCursor) {
      rects = this.multiCursor.map((rect) => ({
        min: { x: BigInt(rect.x), y: BigInt(rect.y) },
        max: { x: BigInt(rect.x + rect.width - 1), y: BigInt(rect.y + rect.height - 1) },
      }));
    } else if (!this.columnRow) {
      rects = [
        {
          min: { x: BigInt(this.cursorPosition.x), y: BigInt(this.cursorPosition.y) },
          max: { x: BigInt(this.cursorPosition.x), y: BigInt(this.cursorPosition.y) },
        },
      ];
    }
    return {
      sheet_id,
      x: BigInt(this.cursorPosition.x),
      y: BigInt(this.cursorPosition.y),
      rects,
      columns,
      rows,
      all,
    };
  }

  // Returns the largest rectangle that contains all the multiCursor rectangles
  getLargestMultiCursorRectangle(): Rectangle {
    if (!this.multiCursor) {
      return new Rectangle(this.cursorPosition.x, this.cursorPosition.y, 1, 1);
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    this.multiCursor.forEach((rect) => {
      left = Math.min(left, rect.x);
      top = Math.min(top, rect.y);
      right = Math.max(right, rect.x + rect.width);
      bottom = Math.max(bottom, rect.y + rect.height);
    });
    return new Rectangle(left, top, right - left, bottom - top);
  }

  overlapsSelection(selection: Selection): boolean {
    return selectionOverlapsSelection(this.getRustSelection(), selection);
  }

  hasOneColumnRowSelection(oneCell?: boolean): boolean {
    return (
      !this.columnRow?.all &&
      !!(
        (this.columnRow?.columns && this.columnRow.columns.length === 1) ||
        (this.columnRow?.rows && this.columnRow.rows.length === 1) ||
        (oneCell && !this.multiCursor)
      )
    );
  }

  includesCell(column: number, row: number): boolean {
    if (this.multiCursor) {
      return this.multiCursor.some((rect) => rect.contains(column, row));
    } else {
      return this.cursorPosition.x === column && this.cursorPosition.y === row;
    }
  }

  // Returns the columns that are selected.
  getColumnsSelection(): number[] {
    const columns = new Set<number>();
    if (this.columnRow?.columns) {
      this.columnRow.columns.forEach((column) => columns.add(column));
    }
    if (this.multiCursor) {
      for (const rect of this.multiCursor) {
        columns.add(rect.x);
      }
    }
    columns.add(this.cursorPosition.x);
    return Array.from(columns);
  }

  // Returns the rows that are selected.
  getRowsSelection(): number[] {
    const rows = new Set<number>();
    if (this.columnRow?.rows) {
      this.columnRow.rows.forEach((row) => rows.add(row));
    }
    if (this.multiCursor) {
      for (const rect of this.multiCursor) {
        rows.add(rect.y);
      }
    }
    rows.add(this.cursorPosition.y);
    return Array.from(rows);
  }
}
