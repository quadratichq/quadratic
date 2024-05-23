//! Holds the state of the cursor for a sheet. Allows for saving and loading of
//! that state as you switch between sheets, a multiplayer user follows your
//! cursor, or you save the cursor state in the URL at ?state=.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Selection } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { IViewportTransformState } from 'pixi-viewport';
import { Rectangle } from 'pixi.js';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { Sheet } from './Sheet';

// Select column and/or row for the entire sheet.
interface ColumnRowCursor {
  columns?: number[];
  rows?: number[];
  all?: true;
}

// Save object for the cursor state.
export interface SheetCursorSave {
  sheetId: string;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor?: { originPosition: Coordinate; terminalPosition: Coordinate }; //{ x: number; y: number; width: number; height: number }[];
  columnRow?: ColumnRowCursor;
}

export class SheetCursor {
  private _viewport?: IViewportTransformState;

  sheetId: string;

  // used to determine if the boxCells (ie, autocomplete) is active
  boxCells: boolean;

  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor?: { originPosition: Coordinate; terminalPosition: Coordinate }; //Rectangle[];
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
      multiCursor: this.multiCursor,
    };
  }

  load(value: SheetCursorSave): void {
    this.keyboardMovePosition = value.keyboardMovePosition;
    this.cursorPosition = value.cursorPosition;
    this.multiCursor = value.multiCursor; //value.multiCursor?.map((rect) => new Rectangle(rect.x, rect.y, rect.width, rect.height));
    multiplayer.sendSelection(this.getMultiplayerSelection());
    pixiApp.cursor.dirty = true;
  }

  changePosition(
    options: {
      multiCursor?: { originPosition: Coordinate; terminalPosition: Coordinate }; //Rectangle[];
      columnRow?: ColumnRowCursor;
      cursorPosition?: Coordinate;
      keyboardMovePosition?: Coordinate;
      ensureVisible?: boolean;
    },
    test?: boolean
  ) {
    if (options.columnRow) {
      this.columnRow = options.columnRow;
      this.multiCursor = undefined;
    } else if (options.multiCursor) {
      this.multiCursor = options.multiCursor;
      this.columnRow = undefined;
    } else {
      this.multiCursor = undefined;
      this.columnRow = undefined;
    }
    if (options.cursorPosition) {
      this.cursorPosition = options.cursorPosition;
      this.keyboardMovePosition = options.keyboardMovePosition ?? this.cursorPosition;
    } else if (options.keyboardMovePosition) {
      this.keyboardMovePosition = options.keyboardMovePosition;
    }
    if (!test) {
      pixiApp.updateCursorPosition({ ensureVisible: options.ensureVisible ?? true });
      if (!inlineEditorHandler.cursorIsMoving) {
        multiplayer.sendSelection(this.getMultiplayerSelection());
      }
    }
  }

  // gets a stringified selection string for multiplayer
  getMultiplayerSelection(): string {
    // TODO
    return '';
    // const cursor = this.cursorPosition;
    // const rectangle = this.multiCursor
    //   ? new Rectangle(
    //       this.multiCursor.originPosition.x,
    //       this.multiCursor.originPosition.y,
    //       this.multiCursor.terminalPosition.x - this.multiCursor.originPosition.x,
    //       this.multiCursor.terminalPosition.y - this.multiCursor.originPosition.y
    //     )
    //   : undefined;
    // return JSON.stringify({ cursor, rectangle });
  }

  changeBoxCells(boxCells: boolean) {
    if (boxCells !== this.boxCells) {
      this.boxCells = boxCells;
    }
  }

  get originPosition(): Coordinate {
    return this.multiCursor ? this.multiCursor.originPosition : this.cursorPosition;
  }

  get terminalPosition(): Coordinate {
    return this.multiCursor ? this.multiCursor.terminalPosition : this.cursorPosition;
  }

  getRectangle(): Rectangle {
    const origin = this.originPosition;
    const terminal = this.terminalPosition;
    return new Rectangle(origin.x, origin.y, terminal.x - origin.x, terminal.y - origin.y);
  }

  getRustSelection(): Selection {
    console.log(this.columnRow);
    const sheet_id = { id: this.sheetId };
    const columns = this.columnRow?.columns ? this.columnRow.columns.map((x) => BigInt(x)) : null;
    const rows = this.columnRow?.rows ? this.columnRow.rows.map((y) => BigInt(y)) : null;
    const all = this.columnRow?.all ?? false;
    const rect = this.getRectangle();
    const rects = [
      {
        min: { x: BigInt(rect.x), y: BigInt(rect.y) },
        max: { x: BigInt(rect.x + rect.width), y: BigInt(rect.y + rect.height) },
      },
    ];
    return {
      sheet_id,
      rects,
      columns,
      rows,
      all,
    };
  }
}
