import { Coordinate } from '../../gridGL/types/size';
import { Sheet } from './Sheet';

export enum PanMode {
  Disabled = 'DISABLED',
  Enabled = 'ENABLED',
  Dragging = 'DRAGGING',
}

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
  sheetId: string;
  panMode: PanMode;
  boxCells: boolean;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor: MultiCursor;
  showInput: boolean;
  inputInitialValue: string;

  constructor(sheet: Sheet) {
    this.sheetId = sheet.id;
    this.boxCells = false;
    this.keyboardMovePosition = { x: 0, y: 0 };
    this.cursorPosition = { x: 0, y: 0 };
    this.multiCursor = undefined;
    this.showInput = false;
    this.inputInitialValue = '';
    this.panMode = PanMode.Disabled;
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
    this.showInput = false;
    this.inputInitialValue = '';
  }

  changePosition(options: {
    multiCursor?: MultiCursor;
    cursorPosition?: Coordinate;
    keyboardMovePosition?: Coordinate;
  }): void {
    this.multiCursor = options.multiCursor;
    if (options.cursorPosition) {
      this.cursorPosition = options.cursorPosition;
      this.keyboardMovePosition = options.keyboardMovePosition ?? this.cursorPosition;
    } else if (options.keyboardMovePosition) {
      this.keyboardMovePosition = options.keyboardMovePosition;
    }
    window.dispatchEvent(new CustomEvent('set-dirty', { detail: { cursor: true, headings: true } }));
    window.dispatchEvent(new CustomEvent('cursor-position'));
  }

  changeInput(input: boolean, initialValue = '') {
    this.showInput = input;
    this.inputInitialValue = initialValue;
    window.dispatchEvent(new CustomEvent('change-input', { detail: { showInput: input } }));
    window.dispatchEvent(new CustomEvent('set-dirty', { detail: { cells: true, cursor: true } }));
  }

  changeBoxCells(boxCells: boolean) {
    if (boxCells !== this.boxCells) {
      this.boxCells = boxCells;
    }
  }

  changePanMode(mode: PanMode): void {
    if (this.panMode !== mode) {
      this.panMode = mode;
      window.dispatchEvent(new CustomEvent('pan-mode', { detail: mode }));
    }
  }

  get originPosition(): Coordinate {
    return this.multiCursor ? this.multiCursor.originPosition : this.cursorPosition;
  }
  get terminalPosition(): Coordinate {
    return this.multiCursor ? this.multiCursor.terminalPosition : this.cursorPosition;
  }
}
