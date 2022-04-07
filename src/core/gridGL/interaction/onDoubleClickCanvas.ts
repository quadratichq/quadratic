import { GridInteractionState } from "../QuadraticGrid";
import { GetCellsDB } from "../../gridDB/Cells/GetCellsDB";
import { NavigateFunction } from "react-router-dom";

export const onDoubleClickCanvas = (
  event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >,
  navigate: NavigateFunction
) => {
  const x = interactionState.cursorPosition.x;
  const y = interactionState.cursorPosition.y;
  GetCellsDB(x, y, x, y).then((cells) => {
    if (cells.length) {
      const cell = cells[0];

      if (cell.type === "TEXT" || cell.type === "COMPUTED") {
        // open single line
        setInteractionState({
          ...interactionState,
          ...{
            showInput: true,
            inputInitialValue: cell.value,
          },
        });
      } else {
        navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
      }
    } else {
      setInteractionState({
        ...interactionState,
        ...{
          showInput: true,
          inputInitialValue: "",
        },
      });
    }
  });
  event.preventDefault();
};
