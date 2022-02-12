import { useRef } from "react";
import useWindowDimensions from "../../utils/useWindowDimensions.js";
import Cursor from "./interaction/cursor";
import { Stage } from "@inlet/react-pixi";
import ViewportComponent from "./ViewportComponent";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { GetCellsDB } from "../gridDB/GetCellsDB";
import CellPixiReact from "./graphics/CellPixiReact";
import { useLoading } from "../../contexts/LoadingContext";

export default function QuadraticGrid() {
  let navigate = useNavigate();
  const { loading } = useLoading();
  const cursorRef = useRef<Cursor>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const cells = useLiveQuery(() => GetCellsDB());

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
          const x = cursorRef.current?.location.x;
          const y = cursorRef.current?.location.y;
          GetCellsDB(x, y, x, y).then((cells) => {
            if (cells.length) {
              navigate(`/code-editor/${x}/${y}/${cells[0].type}`);
            } else {
              navigate(
                `/cell-type-menu/${cursorRef.current?.location.x}/${cursorRef.current?.location.y}`
              );
            }
          });

          event.preventDefault();
        }
      }}
      style={{ display: loading ? "none" : "inline" }}
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
        {!loading &&
          cells?.map((cell) => (
            <CellPixiReact
              key={`${cell.x},${cell.y}`}
              x={cell.x}
              y={cell.y}
              text={cell.value}
              type={cell.type}
            ></CellPixiReact>
          ))}
        {/* 
        TODO: Can add children ReactPixi components for interactive elements such as the cursors 
        <Text text="hello world" anchor={0.5} x={150} y={150}></Text> */}
      </ViewportComponent>
    </Stage>
  );
}
