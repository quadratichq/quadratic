import { Coordinate } from '../../gridGL/types/size';
import { Sheet } from './Sheet';

export interface SheetCursorSave {
  sheetId: string;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor:
    | {
        originPosition: Coordinate;
        terminalPosition: Coordinate;
      }
    | undefined;
}

export class SheetCursor {
  sheetId: string;
  boxCells: boolean;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  multiCursor:
    | {
        originPosition: Coordinate;
        terminalPosition: Coordinate;
      }
    | undefined;
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
}
