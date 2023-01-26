import { atom } from 'recoil';
import { Coordinate } from '../core/gridGL/types/size';
export interface GridInteractionState {
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  showMultiCursor: boolean;
  showHandyMenu: boolean;
  multiCursorPosition: {
    originPosition: Coordinate;
    terminalPosition: Coordinate;
  };
  showInput: boolean;
  inputInitialValue: string;
}

export const gridInteractionStateDefault: GridInteractionState = {
  keyboardMovePosition: { x: 0, y: 0 },
  cursorPosition: { x: 0, y: 0 },
  showMultiCursor: false,
  showHandyMenu: false,
  multiCursorPosition: {
    originPosition: { x: 0, y: 0 },
    terminalPosition: { x: 0, y: 0 },
  },
  showInput: false,
  inputInitialValue: '',
};

export const gridInteractionStateAtom = atom({
  key: 'gridInteractionState', // unique ID (with respect to other atoms/selectors)
  default: gridInteractionStateDefault,
});
