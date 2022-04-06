import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import { PixiComponent } from "@inlet/react-pixi";
import { DeleteCellsDB } from "../../gridDB/Cells/DeleteCellsDB";
import { updateCellAndDCells } from "../../actions/updateCellAndDCells";
import { GridInteractionState } from "../QuadraticGrid";

// @ts-ignore
import TextInput from "pixi-text-input";

interface InputPixiReactProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >;
}

let Input = PixiComponent("Input", {
  create: (props: InputPixiReactProps) => {
    const { interactionState } = props;

    const x_pos = interactionState.cursorPosition.x * CELL_WIDTH;
    const y_pos = interactionState.cursorPosition.y * CELL_HEIGHT;

    // instantiate input and return it
    let input = new TextInput({
      input: {
        fontSize: "14px",
        spellcheck: "false",
        marginLeft: "0px",
        marginTop: "2px",
        width: "100px",
        // backgroundColor: "white",
      },
      box: {
        default: {
          width: "100px",
        },
        focused: {},
        disabled: {},
      },
    });

    input.x = x_pos;
    input.y = y_pos;

    input.substituteText = false;

    input.text = interactionState.inputInitialValue;

    console.log(input);

    const saveAndCloseCell = async () => {
      if (input.text === "") {
        await DeleteCellsDB([
          {
            x: interactionState.cursorPosition.x,
            y: interactionState.cursorPosition.y,
          },
        ]);
      } else {
        await updateCellAndDCells({
          x: interactionState.cursorPosition.x,
          y: interactionState.cursorPosition.y,
          type: "TEXT",
          value: input.text,
        });
      }
      props.setInteractionState({
        ...interactionState,
        ...{
          showInput: false,
          inputInitialValue: "",
        },
      });
    };

    input.on("keydown", (keycode: any) => {
      console.log("key pressed:", keycode);

      // if enter is pressed
      if (keycode === 13) {
        // save cell
        input.blur();
        // move cursor
        // focus canvas
        // unrender input
      }
      // esc
      if (keycode === 27) {
        // save cell
        input.blur();
        // move cursor
        // focus canvas
        // unrender input
        // props.setShowInput(false);
        // props.setInputInitialValue("");
      }

      // Request frame after each keypress.
    });

    input.on("blur", () => {
      // save cell
      saveAndCloseCell();
      // unrender input
    });

    return input;
  },
  didMount: (instance, parent) => {
    // apply custom logic on mount
    instance.focus();
  },
  willUnmount: (instance, parent) => {
    // clean up before removal
  },
  applyProps: (instance, oldProps, newProps) => {
    // props changed
    if (newProps.interactionState.showInput) {
      instance.visible = true;
      instance._dom_visible = true;
    } else {
      instance.visible = false;
      instance._dom_visible = false;
    }

    if (!oldProps?.interactionState?.showInput) {
      if (newProps?.interactionState?.showInput) {
        instance.focus();
      }
    }
  },
  config: {
    // destroy instance on unmount?
    // default true
    destroy: true,

    /// destroy its children on unmount?
    // default true
    destroyChildren: true,
  },
});

const InputPixiReact = (props: InputPixiReactProps) => {
  return (
    <Input
      interactionState={props.interactionState}
      setInteractionState={props.setInteractionState}
    ></Input>
  );
};

export default InputPixiReact;
