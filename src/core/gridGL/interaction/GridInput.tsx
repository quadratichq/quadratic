import { useRef, useEffect, useState } from "react";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import { PixiComponent } from "@inlet/react-pixi";
import { DeleteCellsDB } from "../../gridDB/Cells/DeleteCellsDB";
import { updateCellAndDCells } from "../../actions/updateCellAndDCells";
import { GridInteractionState } from "../QuadraticGrid";
import { Container } from "@inlet/react-pixi";
import type { Viewport } from "pixi-viewport";
import { IntegrationInstructions } from "@mui/icons-material";
import { CellTypes } from "../../gridDB/db";
import CellReference from "../types/cellReference";

// let Input = PixiComponent("Input", {
//   create: (props: InputPixiReactProps) => {
//     const { interactionState } = props;

//     const x_pos = interactionState.cursorPosition.x * CELL_WIDTH;
//     const y_pos = interactionState.cursorPosition.y * CELL_HEIGHT;

//     // instantiate input and return it
//     let input = new TextInput({
//       input: {
//         fontSize: "14px",
//         spellcheck: "false",
//         marginLeft: "0px",
//         marginTop: "2px",
//         width: "100px",
//         // backgroundColor: "white",
//       },
//       box: {
//         default: {
//           width: "100px",
//         },
//         focused: {},
//         disabled: {},
//       },
//     });

//     input.x = x_pos;
//     input.y = y_pos;

//     // input.substituteText = false;

//     input.placeholderColor = 0xffffff;

//     input.text = interactionState.inputInitialValue;

//     console.log(input);

//     input.on("keydown", (keycode: any) => {
//       console.log("key pressed:", keycode);

//       // if enter is pressed
//       if (keycode === 13) {
//         // save cell
//         input.blur();
//         // move cursor
//         // focus canvas
//         // unrender input
//       }
//       // esc
//       if (keycode === 27) {
//         // save cell
//         input.blur();
//         // move cursor
//         // focus canvas
//         // unrender input
//         // props.setShowInput(false);
//         // props.setInputInitialValue("");
//       }

//       // Request frame after each keypress.
//     });

//     input.on("blur", () => {
//       // save cell
//       saveAndCloseCell();
//       // unrender input
//     });

//     return input;
//   },
//   didMount: (instance, parent) => {
//     // apply custom logic on mount
//     instance.focus();
//   },
//   willUnmount: (instance, parent) => {
//     // clean up before removal
//   },
//   applyProps: (instance, oldProps, newProps) => {
//     if (!oldProps?.interactionState?.showInput) {
//       if (newProps?.interactionState?.showInput) {
//         instance.focus();
//       }
//     }
//   },
//   config: {
//     // destroy instance on unmount?
//     // default true
//     destroy: true,

//     /// destroy its children on unmount?
//     // default true
//     destroyChildren: true,
//   },
// });

interface InputPixiReactProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
}

export const GridInput = (props: InputPixiReactProps) => {
  const { interactionState, setInteractionState, viewportRef } = props;

  const [value, setValue] = useState(interactionState.inputInitialValue);
  const cellLoation = useRef(interactionState.cursorPosition);

  // if (!props.viewportRef.current) return <></>;

  // let viewport = props.viewportRef.current;

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
        value: value,
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
    setValue("");
    document.getElementById("QuadraticCanvasID")?.focus();
  };

  if (!interactionState.showInput) {
    return null;
  } else {
    if (value === "" && value !== interactionState.inputInitialValue) {
      setValue(interactionState.inputInitialValue);
      cellLoation.current = interactionState.cursorPosition;
    }
  }

  return (
    <input
      autoFocus
      style={{
        display: "block",
        position: "absolute",
        top: 100,
        left: 20,
        border: "none",
        outline: "none",
        lineHeight: "1",
        background: "none",
        transformOrigin: "0 0",
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
