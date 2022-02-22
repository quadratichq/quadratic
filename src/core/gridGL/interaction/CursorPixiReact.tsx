import { useCallback } from "react";

import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import colors from "../../../theme/colors";

import { Graphics, Container } from "@inlet/react-pixi";

interface CursorPixiReactProps {
  x: number;
  y: number;
}

const CursorPixiReact = (props: CursorPixiReactProps) => {
  const x_pos = props.x * CELL_WIDTH;
  const y_pos = props.y * CELL_HEIGHT;

  const draw_outline = useCallback(
    (g) => {
      g.clear();
      g.lineStyle(1.5, colors.cursorCell);
      g.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);
    },
    [x_pos, y_pos]
  );

  return (
    <Container>
      <Graphics draw={draw_outline}></Graphics>
    </Container>
  );
};

export default CursorPixiReact;
