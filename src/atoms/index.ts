import { atom } from "recoil";
import CellReference from "../core/gridGL/types/cellReference";

export const cursorPositionAtom = atom({
  key: "cursorPosition", // unique ID (with respect to other atoms/selectors)
  default: { x: 5, y: 5 } as CellReference,
});

interface multiCursorPosition {
  originLocation: CellReference;
  terminalLocation: CellReference;
  color?: number;
}

export const multicursorPositionAtom = atom({
  key: "multicursorPosition", // unique ID (with respect to other atoms/selectors)
  default: {
    originLocation: { x: 0, y: 0 },
    terminalLocation: { x: 5, y: 5 },
  } as multiCursorPosition,
});
