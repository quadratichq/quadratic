import CellReference from "../types/cellReference";
import { SetterOrUpdater } from "recoil";

export const onKeyDownCanvas = (
  event: React.KeyboardEvent<HTMLCanvasElement>,
  cursorPosition: CellReference,
  setCursorPosition: SetterOrUpdater<CellReference>
) => {
  console.log(event);
  // Prevent these commands if "command" key is being pressed
  if (event.metaKey) {
    return;
  }

  if (event.key === "ArrowUp") {
    setCursorPosition({
      x: cursorPosition.x,
      y: cursorPosition.y - 1,
    });
    event.preventDefault();
  }
  if (event.key === "ArrowRight") {
    setCursorPosition({
      x: cursorPosition.x + 1,
      y: cursorPosition.y,
    });
    event.preventDefault();
  }
  if (event.key === "ArrowLeft") {
    setCursorPosition({
      x: cursorPosition.x - 1,
      y: cursorPosition.y,
    });
    event.preventDefault();
  }
  if (event.key === "ArrowDown") {
    setCursorPosition({
      x: cursorPosition.x,
      y: cursorPosition.y + 1,
    });
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
