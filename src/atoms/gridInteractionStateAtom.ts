import { atom } from 'recoil';
import { Coordinate } from '../gridGL/types/size';

export enum PanMode {
  Disabled,
  Enabled,
  Dragging,
}

export interface GridInteractionState {
  panMode: PanMode;
  keyboardMovePosition: Coordinate;
  cursorPosition: Coordinate;
  showMultiCursor: boolean;
  multiCursorPosition: {
    originPosition: Coordinate;
    terminalPosition: Coordinate;
  };
  showInput: boolean;
  inputInitialValue: string;
}

export const gridInteractionStateDefault: GridInteractionState = {
  panMode: PanMode.Disabled,
  keyboardMovePosition: { x: 0, y: 0 },
  cursorPosition: { x: 0, y: 0 },
  showMultiCursor: false,
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
