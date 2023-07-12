import { Coordinate } from '../../gridGL/types/size';

export class SheetCursor {
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

  constructor() {
    this.boxCells = false;
    this.keyboardMovePosition = { x: 0, y: 0 };
    this.cursorPosition = { x: 0, y: 0 };
    this.multiCursor = undefined;
    this.showInput = false;
    this.inputInitialValue = '';
  }
}
