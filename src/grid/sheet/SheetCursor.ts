import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
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
    pixiAppEvents.cursorPosition();
  }

  changeInput(input: boolean, initialValue = '') {
    this.showInput = input;
    this.inputInitialValue = initialValue;
    pixiAppEvents.setDirty({ cells: true, cursor: true });

    // this is used by CellInput to control visibility
    window.dispatchEvent(new CustomEvent('change-input', { detail: { showInput: input } }));
  }

  changeBoxCells(boxCells: boolean) {
    if (boxCells !== this.boxCells) {
      this.boxCells = boxCells;
    }
  }

  changePanMode(mode: PanMode): void {
    if (this.panMode !== mode) {
      this.panMode = mode;

      // this is used by QuadraticGrid to trigger changes in pan mode
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
