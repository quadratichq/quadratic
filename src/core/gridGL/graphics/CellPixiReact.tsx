import { useCallback } from "react";
import { Graphics, Container } from "@inlet/react-pixi";

import FastBitmapText from "./primatives/FastBitmapText";

import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import { CellTypes } from "../../gridDB/db";
import colors from "../../../theme/colors";

interface CellPixiReactProps {
  x: number;
  y: number;
  text: string;
  type: CellTypes;
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

      if (props.type === "TEXT") {
        g.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);
      } else if (props.type === "PYTHON") {
        g.lineStyle(1, colors.cellColorUserPython, 0.75, 0.5, true);
      } else if (props.type === "COMPUTED") {
        g.lineStyle(1, colors.independence, 0.75, 0.5, true);
      }

      g.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);
    },
    [x_pos, y_pos, props.type]
  );

  return (
    <Container interactiveChildren={false}>
      <FastBitmapText
        x={x_pos + margin_left}
        y={y_pos + margin_top}
        text={props.text}
      />
      <Graphics draw={draw_outline} />
    </Container>
  );
};

export default CellPixiReact;
