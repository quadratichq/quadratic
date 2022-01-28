import useWindowDimensions from "../utils/useWindowDimensions.js";
import { Stage, Text } from "@inlet/react-pixi";
import ViewportComponent from "./ViewPortComponent";

export default function QuadraticGrid() {
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
      // Disable rendering on each frame, instead render state change (next line)
      // This causes the problem of never rerendering unless react triggers a rerender
      // raf={false}
      // renderOnComponentChange={true}
    >
      <ViewportComponent screenWidth={windowWidth} screenHeight={windowHeight}>
        <Text text="hello world" anchor={0.5} x={150} y={150}></Text>
      </ViewportComponent>
    </Stage>
  );
}
