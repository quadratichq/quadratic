import { atom } from 'recoil';
import CellReference from '../core/gridGL/types/cellReference';
export interface GridInteractionState {
  keyboardMovePosition: CellReference;
  cursorPosition: CellReference;
  showMultiCursor: boolean;
  multiCursorPosition: {
    originPosition: CellReference;
    terminalPosition: CellReference;
  };
  showInput: boolean;
  inputInitialValue: string;
}

export const gridInteractionStateDefault: GridInteractionState = {
  keyboardMovePosition: { x: 0, y: 0 },
  cursorPosition: { x: 0, y: 0 },
  showMultiCursor: false,
  multiCursorPosition: {
    originPosition: { x: 0, y: 0 },
    terminalPosition: { x: 0, y: 0 },
  },
  showInput: false,
  inputInitialValue: '',
}

export const gridInteractionStateAtom = atom({
  key: 'gridInteractionState', // unique ID (with respect to other atoms/selectors)
  default: gridInteractionStateDefault,
});
