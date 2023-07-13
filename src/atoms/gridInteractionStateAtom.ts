import { atom } from 'recoil';
// import { Coordinate } from '../gridGL/types/size';

// export enum PanMode {
//   Disabled = 'DISABLED',
//   Enabled = 'ENABLED',
//   Dragging = 'DRAGGING',
// }

export interface GridInteractionState {
  // panMode: PanMode;
  // boxCells: boolean;
  // keyboardMovePosition: Coordinate;
  // cursorPosition: Coordinate;
  // showMultiCursor: boolean;
  // multiCursorPosition: {
  //   originPosition: Coordinate;
  //   terminalPosition: Coordinate;
  // };
  // showInput: boolean;
  // inputInitialValue: string;
}

export const gridInteractionStateDefault: GridInteractionState = {
  // panMode: PanMode.Disabled,
  // boxCells: false,
  // keyboardMovePosition: { x: 0, y: 0 },
  // cursorPosition: { x: 0, y: 0 },
  // showMultiCursor: false,
  // multiCursorPosition: {
  //   originPosition: { x: 0, y: 0 },
  //   terminalPosition: { x: 0, y: 0 },
  // },
  // showInput: false,
  // inputInitialValue: '',
};

export const gridInteractionStateAtom = atom({
  key: 'gridInteractionState', // unique ID (with respect to other atoms/selectors)
  default: gridInteractionStateDefault,
});
