import { useRef } from "react";
import useWindowDimensions from "../../hooks/useWindowDimensions";
import Cursor from "./interaction/cursor";
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

export default function QuadraticGrid() {
  let navigate = useNavigate();
  const { loading } = useLoading();
  const cursorRef = useRef<Cursor>();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const cells = useLiveQuery(() => GetCellsDB());
  const [showGridAxes] = useLocalStorage("showGridAxes", true);

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
      raf={false}
      renderOnComponentChange={true}
    >
      <ViewportComponent
        screenWidth={windowWidth}
        screenHeight={windowHeight}
        cursorRef={cursorRef}
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
      </ViewportComponent>
    </Stage>
  );
}
