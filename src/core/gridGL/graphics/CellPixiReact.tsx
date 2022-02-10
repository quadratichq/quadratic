import { useCallback } from "react";
import { Graphics, Container } from "@inlet/react-pixi";

import FastBitmapText from "./primatives/FastBitmapText";

import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import colors from "../../../theme/colors";

interface CellPixiReactProps {
  x: number;
  y: number;
  text: string;
}

const CellPixiReact = (props: CellPixiReactProps) => {
  // Calculate X and Y positions
  const x_pos = props.x * CELL_WIDTH;
  const y_pos = props.y * CELL_HEIGHT;
  const margin_left = 2;
  const margin_top = -1;

  const draw_outline = useCallback(
    (g) => {
      g.clear();
      g.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);
      g.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);
    },
    [x_pos, y_pos]
  );

  return (
    <Container>
      <FastBitmapText
        x={x_pos + margin_left}
        y={y_pos + margin_top}
        text={props.text}
      ></FastBitmapText>
      <Graphics draw={draw_outline}></Graphics>
    </Container>
  );
};

export default CellPixiReact;
