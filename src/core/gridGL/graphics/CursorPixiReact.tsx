import { useCallback } from 'react';

import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { colors } from '../../../theme/colors';
import { Graphics, Container } from '@inlet/react-pixi';
import CellReference from '../types/cellReference';
interface CursorPixiReactProps {
  location: CellReference;
  color?: number;
}

const CursorPixiReact = (props: CursorPixiReactProps) => {
  const { location, color } = props;
  const x_pos = location.x * CELL_WIDTH;
  const y_pos = location.y * CELL_HEIGHT;

  const draw_outline = useCallback(
    (g) => {
      g.clear();

      if (color) g.lineStyle(1.5, color);
      else g.lineStyle(1.5, colors.cursorCell);

      g.drawRect(x_pos, y_pos, CELL_WIDTH, CELL_HEIGHT);
    },
    [x_pos, y_pos, color]
  );

  return (
    <Container>
      <Graphics draw={draw_outline}></Graphics>
    </Container>
  );
};

export default CursorPixiReact;
