import CellReference from "../types/cellReference";
import { SetterOrUpdater } from "recoil";
import { MultiCursorPosition } from "../../../atoms/cursorAtoms";

export const onKeyDownCanvas = (
  event: React.KeyboardEvent<HTMLCanvasElement>,
  cursorPosition: CellReference,
  setCursorPosition: SetterOrUpdater<CellReference>,
  setMulticursorPosition: SetterOrUpdater<MultiCursorPosition>
) => {
  console.log(event);
  // Prevent these commands if "command" key is being pressed
  if (event.metaKey) {
    return;
  }

  const hideMultiCursor = () => {
    setMulticursorPosition({
      originLocation: { x: 0, y: 0 },
      terminalLocation: { x: 0, y: 0 },
      visible: false,
    } as MultiCursorPosition);
  };

  if (event.key === "ArrowUp") {
    setCursorPosition({
      x: cursorPosition.x,
      y: cursorPosition.y - 1,
    });
    hideMultiCursor();
    event.preventDefault();
  }
  if (event.key === "ArrowRight") {
    setCursorPosition({
      x: cursorPosition.x + 1,
      y: cursorPosition.y,
    });
    hideMultiCursor();
    event.preventDefault();
  }
  if (event.key === "ArrowLeft") {
    setCursorPosition({
      x: cursorPosition.x - 1,
      y: cursorPosition.y,
    });
    hideMultiCursor();
    event.preventDefault();
  }
  if (event.key === "ArrowDown") {
    setCursorPosition({
      x: cursorPosition.x,
      y: cursorPosition.y + 1,
    });
    hideMultiCursor();
    event.preventDefault();
  }

  // if (event.key === "/") {
  //   const x = cursorPosition.x;
  //   const y = cursorPosition.y;
  //   GetCellsDB(x, y, x, y).then((cells) => {
  //     if (cells.length) {
  //       navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
  //     } else {
  //       navigate(`/cell-type-menu/${x}/${y}`);
  //     }
  //   });

  //   event.preventDefault();
  // }
};
