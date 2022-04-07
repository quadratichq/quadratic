import { useEffect, useRef, useState } from "react";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";

import { DeleteCellsDB } from "../../gridDB/Cells/DeleteCellsDB";
import { updateCellAndDCells } from "../../actions/updateCellAndDCells";
import { GridInteractionState } from "../QuadraticGrid";
import { Viewport } from "pixi-viewport";
import CellReference from "../types/cellReference";

interface InputPixiReactProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
}

export const GridInput = (props: InputPixiReactProps) => {
  const { interactionState, setInteractionState, viewportRef } = props;

  const [value, setValue] = useState<string | undefined>(undefined);
  const cellLoation = useRef(interactionState.cursorPosition);
  const textInput = useRef<HTMLInputElement>(null);

  const movedListener = () => {
    let transform = "";
    let m = viewportRef.current?.worldTransform;

    let cell_offset_scaled = viewportRef.current?.toScreen(
      cellLoation.current.x * CELL_WIDTH + 1,
      cellLoation.current.y * CELL_HEIGHT + 1
    );

    console.log("cell_offset_scaled", cell_offset_scaled);

    if (m && cell_offset_scaled)
      transform =
        "matrix(" +
        [m.a, m.b, m.c, m.d, cell_offset_scaled.x, cell_offset_scaled.y].join(
          ","
        ) +
        ")";

    if (textInput.current) textInput.current.style.transform = transform;

    return transform;
  };

  const viewport = viewportRef.current;
  if (!viewport) return null;

  // If the input is not shown, we can do nothing and return null
  if (!interactionState.showInput) {
    return null;
  }

  const closeInput = async (transpose = { x: 0, y: 0 } as CellReference) => {
    console.log("closing");
    if (value === "") {
      await DeleteCellsDB([
        {
          x: cellLoation.current.x,
          y: cellLoation.current.y,
        },
      ]);
    } else {
      await updateCellAndDCells({
        x: cellLoation.current.x,
        y: cellLoation.current.y,
        type: "TEXT",
        value: value || "",
      });
    }

    setInteractionState({
      ...interactionState,
      ...{
        cursorPosition: {
          x: interactionState.cursorPosition.x + transpose.x,
          y: interactionState.cursorPosition.y + transpose.y,
        },
        showInput: false,
        inputInitialValue: "",
      },
    });
    setValue(undefined);
    document.getElementById("QuadraticCanvasID")?.focus();

    // TODO: this may be overly broad
    viewport.removeAllListeners("moved-end");
    viewport.removeAllListeners("moved");
  };

  if (value === undefined && value !== interactionState.inputInitialValue) {
    // Happens on initialization
    setValue(interactionState.inputInitialValue);
    cellLoation.current = interactionState.cursorPosition;

    viewport.addListener("moved", movedListener);
    viewport.addListener("moved-end", movedListener);
  }

  // set input's initial position correctly
  const transform = movedListener();

  return (
    <input
      autoFocus
      ref={textInput}
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        left: 0,
        width: 100,
        border: "none",
        outline: "none",
        lineHeight: "1",
        background: "none",
        transformOrigin: "0 0",
        transform: transform,
        fontSize: "14px",
      }}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onBlur={() => {
        closeInput();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          closeInput({ x: 0, y: 1 });
        } else if (event.key === "Tab") {
          closeInput({ x: 1, y: 0 });
          event.preventDefault();
        } else if (event.key === "Escape") {
          closeInput();
        }
      }}
    ></input>
  );
};
