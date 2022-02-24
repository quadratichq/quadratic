import { useCallback } from "react";
import { Graphics } from "@inlet/react-pixi";
import { Graphics as PixiGraphics } from "pixi.js";

interface AxesPixiReactProps {
  visible: boolean;
}

const AxesPixiReact = (props: AxesPixiReactProps) => {
  const draw_outline = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      if (props.visible) {
        g.lineStyle(1, 0x000000, 0.2, 0, true);

        g.moveTo(-1000000000000, 0);
        g.lineTo(1000000000000, 0);

        g.moveTo(0, -1000000000000);
        g.lineTo(0, 1000000000000);
      }
    },
    [props.visible]
  );

  return <Graphics draw={draw_outline} />;
};

export default AxesPixiReact;
