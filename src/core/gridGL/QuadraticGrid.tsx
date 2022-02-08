import { useRef } from "react";
import useWindowDimensions from "../../utils/useWindowDimensions.js";
import Cursor from "./interaction/cursor";
import { Stage } from "@inlet/react-pixi";
import ViewportComponent from "./ViewportComponent";
import { useNavigate } from "react-router-dom";

export default function QuadraticGrid() {
  let navigate = useNavigate();
  const cursorRef = useRef<Cursor>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  return (
    <Stage
      height={windowHeight}
      width={windowWidth}
      options={{
        resizeTo: window,
        resolution: window.devicePixelRatio,
        backgroundColor: 0xffffff,
        antialias: true,
        autoDensity: true,
      }}
      onKeyDown={(event) => {
        if (event.key === "/") {
          // this.globals.cell_type_menu_ref.current?.open();
          console.log("attempting to navigate");
          navigate(
            `/cell-type-menu/${cursorRef.current?.location.x}/${cursorRef.current?.location.y}`
          );
          event.preventDefault();
        }
      }}
      // Disable rendering on each frame, instead render state change (next line)
      // This causes the problem of never rerendering unless react triggers a rerender
      // raf={false}
      // renderOnComponentChange={true}
    >
      <ViewportComponent
        screenWidth={windowWidth}
        screenHeight={windowHeight}
        cursorRef={cursorRef}
      >
        {/* 
        TODO: Can add children ReactPixi components for interactive elements such as the cursors 
        <Text text="hello world" anchor={0.5} x={150} y={150}></Text> */}
      </ViewportComponent>
    </Stage>
  );
}
