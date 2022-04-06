import { useRef, useEffect, useState } from "react";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  CELL_TEXT_MARGIN_LEFT,
  CELL_TEXT_MARGIN_TOP,
} from "../../../constants/gridConstants";
import { PixiComponent } from "@inlet/react-pixi";
import { DeleteCellsDB } from "../../gridDB/Cells/DeleteCellsDB";
import { updateCellAndDCells } from "../../actions/updateCellAndDCells";
import { GridInteractionState } from "../QuadraticGrid";
import { Container } from "@inlet/react-pixi";
import type { Viewport } from "pixi-viewport";
import { IntegrationInstructions, ViewDayOutlined } from "@mui/icons-material";
import { CellTypes } from "../../gridDB/db";
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
  const textInput = useRef(null);

  // if (!props.viewportRef.current) return <></>;

  // let viewport = props.viewportRef.current;

  if (!interactionState.showInput) {
    return null;
  }

  const movedListener = () => {
    console.log("moved");
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

    //@ts-expect-error
    if (textInput.current) textInput.current.style.transform = transform;

    return transform;
  };

  const saveAndCloseCell = async (
    transpose = { x: 0, y: 0 } as CellReference
  ) => {
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

    viewportRef.current?.removeListener("moved", movedListener);
    viewportRef.current?.removeListener("moved-end", movedListener);
  };

  if (value === undefined && value !== interactionState.inputInitialValue) {
    // Happens on initialization
    setValue(interactionState.inputInitialValue);
    cellLoation.current = interactionState.cursorPosition;
  }

  viewportRef.current?.addListener("moved", movedListener);
  viewportRef.current?.addListener("moved-end", movedListener);

  // set initial position correctly
  const transform = movedListener();

  console.log("transform", transform);

  return (
    <input
      autoFocus
      ref={textInput}
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        left: 0,
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
        saveAndCloseCell();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          saveAndCloseCell({ x: 0, y: 1 });
        } else if (event.key == "Tab") {
          saveAndCloseCell({ x: 1, y: 0 });
          event.preventDefault();
        } else if (event.key === "Escape") {
          saveAndCloseCell();
        }
      }}
    ></input>
  );
};
