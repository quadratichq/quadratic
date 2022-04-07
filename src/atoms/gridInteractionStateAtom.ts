import { atom } from "recoil";
import CellReference from "../core/gridGL/types/cellReference";
export interface GridInteractionState {
  cursorPosition: CellReference;
  showMultiCursor: boolean;
  multiCursorPosition: {
    originPosition: CellReference;
    terminalPosition: CellReference;
  };
  showInput: boolean;
  inputInitialValue: string;
}

export const gridInteractionStateAtom = atom({
  key: "gridInteractionState", // unique ID (with respect to other atoms/selectors)
  default: {
    cursorPosition: { x: 0, y: 0 },
    showMultiCursor: false,
    multiCursorPosition: {
      originPosition: { x: 0, y: 0 },
      terminalPosition: { x: 0, y: 0 },
    },
    showInput: false,
    inputInitialValue: "",
  } as GridInteractionState,
});
