import { useCallback } from "react";

import CellReference from "../types/cellReference";
import { CELL_WIDTH, CELL_HEIGHT } from "../../../constants/gridConstants";
import colors from "../../../theme/colors";

import { Graphics } from "@inlet/react-pixi";

interface CursorPixiReactProps {
  originLocation: CellReference;
  terminalLocation: CellReference;
  visible: boolean;
  color?: number;
}

const MultiCursorPixiReact = (props: CursorPixiReactProps) => {
  const x0_pos = props.originLocation.x * CELL_WIDTH;
  const y0_pos = props.originLocation.y * CELL_HEIGHT;
  const x1_pos = (props.terminalLocation.x + 1) * CELL_WIDTH;
  const y1_pos = (props.terminalLocation.y + 1) * CELL_HEIGHT;

  let { color, visible } = props;
  if (!color) color = colors.cursorCell;

  // render with pixi
  const draw_outline = useCallback(
    (g) => {
      g.clear();

      if (!visible) return;

      g.lineStyle(1, color, 1, 0, true);
      g.beginFill(color, 0.1);
      g.drawRect(x0_pos, y0_pos, x1_pos - x0_pos, y1_pos - y0_pos);
    },
    [x0_pos, y0_pos, x1_pos, y1_pos, color, visible]
  );

  return <Graphics draw={draw_outline}></Graphics>;
};

export default MultiCursorPixiReact;
