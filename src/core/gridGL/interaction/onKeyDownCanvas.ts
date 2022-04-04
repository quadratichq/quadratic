import CellReference from "../types/cellReference";
import { SetterOrUpdater } from "recoil";
import { MultiCursorPosition } from "../../../atoms/cursorAtoms";
import { copyToClipboard, pasteFromClipboard } from "../../actions/clipboard";
import { deleteCellsRange } from "../../actions/deleteCellsRange";
import { GetCellsDB } from "../../gridDB/Cells/GetCellsDB";
import { NavigateFunction } from "react-router-dom";

export const onKeyDownCanvas = (
  event: React.KeyboardEvent<HTMLCanvasElement>,
  cursorPosition: CellReference,
  setCursorPosition: SetterOrUpdater<CellReference>,
  multiCursorPosition: MultiCursorPosition,
  setMulticursorPosition: SetterOrUpdater<MultiCursorPosition>,
  navigate: NavigateFunction
) => {
  // Helper Functions
  const hideMultiCursor = () => {
    setMulticursorPosition({
      originLocation: { x: 0, y: 0 },
      terminalLocation: { x: 0, y: 0 },
      visible: false,
    } as MultiCursorPosition);
  };

  // TODO make commands work cross platform
  // Command + V
  if (event.metaKey && event.code === "KeyV") {
    console.log("made it here v ");
    pasteFromClipboard({
      x: cursorPosition.x,
      y: cursorPosition.y,
    });
  }

  // Command + C
  if (event.metaKey && event.code === "KeyC") {
    console.log("made it here c ");
    copyToClipboard(
      {
        x: multiCursorPosition.originLocation.x,
        y: multiCursorPosition.originLocation.y,
      },
      {
        x: multiCursorPosition.terminalLocation.x,
        y: multiCursorPosition.terminalLocation.y,
      }
    );
  }

  // Prevent these commands if "command" key is being pressed
  if (event.metaKey) {
    return;
  }

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

  if (event.key === "Tab") {
    // TODO: save previous cell

    // move single cursor one right
    setCursorPosition({
      x: cursorPosition.x + 1,
      y: cursorPosition.y,
    });
    event.preventDefault();
  }

  if (event.key === "Backspace") {
    deleteCellsRange(
      {
        x: multiCursorPosition.originLocation.x,
        y: multiCursorPosition.originLocation.y,
      },
      {
        x: multiCursorPosition.terminalLocation.x,
        y: multiCursorPosition.terminalLocation.y,
      }
    );
    event.preventDefault();
  }

  if (event.key === "/") {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    GetCellsDB(x, y, x, y).then((cells) => {
      if (cells.length) {
        navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
      } else {
        navigate(`/cell-type-menu/${x}/${y}`);
      }
    });

    event.preventDefault();
  }
};
