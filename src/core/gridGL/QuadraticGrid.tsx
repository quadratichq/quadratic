import { useEffect, useRef, useState } from "react";
import useWindowDimensions from "../../hooks/useWindowDimensions";
import type { Viewport } from "pixi-viewport";
import { Stage } from "@inlet/react-pixi";
import ViewportComponent from "./ViewportComponent";
import { GetCellsDB } from "../gridDB/Cells/GetCellsDB";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useLoading } from "../../contexts/LoadingContext";
import useLocalStorage from "../../hooks/useLocalStorage";
import CellPixiReact from "./graphics/CellPixiReact";
import AxesPixiReact from "./graphics/AxesPixiReact";
import CursorPixiReact from "./interaction/CursorPixiReact";
import MultiCursorPixiReact from "./interaction/MultiCursorPixiReact";
import {
  cursorPositionAtom,
  multicursorPositionAtom,
} from "../../atoms/cursorAtoms";
import { useRecoilState } from "recoil";
import { CELL_WIDTH, CELL_HEIGHT } from "../../constants/gridConstants";
import { onKeyDownCanvas } from "./interaction/onKeyDownCanvas";
import { onMouseDownCanvas } from "./interaction/onMouseDownCanvas";
import InputPixiReact from "./interaction/InputPixiReact";
import CellReference from "./types/cellReference";

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

export default function QuadraticGrid() {
  let navigate = useNavigate();
  const { loading } = useLoading();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const cells = useLiveQuery(() => GetCellsDB());

  const [showGridAxes] = useLocalStorage("showGridAxes", true);

  // const [cursorPosition, setCursorPosition] =
  //   useRecoilState(cursorPositionAtom);
  // const [multicursorPosition, setMulticursorPosition] = useRecoilState(
  //   multicursorPositionAtom
  // );
  // const [showInput, setShowInput] = useState<boolean>(false);
  // const [inputInitialValue, setInputInitialValue] = useState<string>("");

  const [interactionState, setInteractionState] =
    useState<GridInteractionState>({
      cursorPosition: { x: 0, y: 0 },
      showMultiCursor: false,
      multiCursorPosition: {
        originPosition: { x: 0, y: 0 },
        terminalPosition: { x: 0, y: 0 },
      },
      showInput: false,
      inputInitialValue: "",
    });

  console.log("state change", interactionState);

  // useEffect(() => {
  //   // TODO: THIS DOES NOT WORK
  //   if (viewportRef.current)
  //     viewportRef.current.ensureVisible(
  //       cursorPosition.x,
  //       cursorPosition.y,
  //       CELL_WIDTH,
  //       CELL_HEIGHT,
  //       false
  //     );
  // }, [cursorPosition]);

  return (
    <Stage
      height={windowHeight}
      width={windowWidth}
      options={{
        resizeTo: window,
        resolution:
          window.devicePixelRatio === 1.0 ? 2 : window.devicePixelRatio,
        backgroundColor: 0xffffff,
        antialias: true,
        autoDensity: true,
      }}
      tabIndex={0}
      onKeyDown={(event) => {
        onKeyDownCanvas(event, interactionState, setInteractionState, navigate);
      }}
      onMouseDown={(event) => {
        onMouseDownCanvas(
          event,
          interactionState,
          setInteractionState,
          viewportRef
        );
      }}
      style={{ display: loading ? "none" : "inline" }}
      // Disable rendering on each frame, instead render state change (next line)
      raf={false}
      renderOnComponentChange={true}
    >
      <ViewportComponent
        screenWidth={windowWidth}
        screenHeight={windowHeight}
        viewportRef={viewportRef}
      >
        {!loading &&
          cells?.map((cell) => (
            <CellPixiReact
              key={`${cell.x},${cell.y}`}
              x={cell.x}
              y={cell.y}
              text={cell.value}
              type={cell.type}
              renderText={true}
            ></CellPixiReact>
          ))}
        <AxesPixiReact visible={showGridAxes}></AxesPixiReact>
        <CursorPixiReact
          location={interactionState.cursorPosition}
        ></CursorPixiReact>
        <MultiCursorPixiReact
          originLocation={interactionState.multiCursorPosition.originPosition}
          terminalLocation={
            interactionState.multiCursorPosition.terminalPosition
          }
          visible={interactionState.showMultiCursor}
        ></MultiCursorPixiReact>
        <InputPixiReact
          interactionState={interactionState}
          setInteractionState={setInteractionState}
        ></InputPixiReact>
      </ViewportComponent>
    </Stage>
  );
}
