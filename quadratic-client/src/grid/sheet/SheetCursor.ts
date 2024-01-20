import { multiplayer } from '@/multiplayer/multiplayer';
import { IViewportTransformState } from 'pixi-viewport';
import { Rectangle } from 'pixi.js';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { Pos } from '../../quadratic-core/quadratic_core';
import { Sheet } from './Sheet';

type MultiCursor =
  | {
      originPosition: Coordinate;
      terminalPosition: Coordinate;
    }
  | undefined;

export interface SheetCursorSave {
  sheetId: string;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor: MultiCursor;
}

export class SheetCursor {
  private _viewport?: IViewportTransformState;

  sheetId: string;
  boxCells: boolean;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor: MultiCursor;

  constructor(sheet: Sheet) {
    this.sheetId = sheet.id;
    this.boxCells = false;
    this.keyboardMovePosition = { x: 0, y: 0 };
    this.cursorPosition = { x: 0, y: 0 };
    this.multiCursor = undefined;
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
    this.multiCursor = value.multiCursor;
    multiplayer.sendSelection(this.getMultiplayerSelection());
    pixiApp.cursor.dirty = true;
  }

  changePosition(options: {
    multiCursor?: MultiCursor;
    cursorPosition?: Coordinate;
    keyboardMovePosition?: Coordinate;
    ensureVisible?: boolean;
  }): void {
    this.multiCursor = options.multiCursor;
    if (options.cursorPosition) {
      this.cursorPosition = options.cursorPosition;
      this.keyboardMovePosition = options.keyboardMovePosition ?? this.cursorPosition;
    } else if (options.keyboardMovePosition) {
      this.keyboardMovePosition = options.keyboardMovePosition;
    }
    pixiApp.updateCursorPosition({ ensureVisible: options.ensureVisible ?? true });
    multiplayer.sendSelection(this.getMultiplayerSelection());
  }

  // gets a stringified selection string for multiplayer
  getMultiplayerSelection(): string {
    const cursor = this.cursorPosition;
    const rectangle = this.multiCursor
      ? new Rectangle(
          this.multiCursor.originPosition.x,
          this.multiCursor.originPosition.y,
          this.multiCursor.terminalPosition.x - this.multiCursor.originPosition.x,
          this.multiCursor.terminalPosition.y - this.multiCursor.originPosition.y
        )
      : undefined;
    return JSON.stringify({ cursor, rectangle });
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

  // Returns the Rust pos of the cursor
  getPos(): Pos {
    return new Pos(this.cursorPosition.x, this.cursorPosition.y);
  }

  getRectangle(): Rectangle {
    const origin = this.originPosition;
    const terminal = this.terminalPosition;
    return new Rectangle(origin.x, origin.y, terminal.x - origin.x, terminal.y - origin.y);
  }
}
