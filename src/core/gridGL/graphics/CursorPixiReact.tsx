import { useCallback } from 'react';

import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import colors from '../../../theme/colors';
import { Graphics, Container } from '@inlet/react-pixi';
import CellReference from '../types/cellReference';
import FastBitmapText from '../graphics/primatives/FastBitmapText';

interface CursorPixiReactProps {
  location: CellReference;
  showPlaceholder: boolean;
}

const CursorPixiReact = (props: CursorPixiReactProps) => {
  const x_pos = props.location.x * CELL_WIDTH;
  const y_pos = props.location.y * CELL_HEIGHT;

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
      <FastBitmapText
        x={x_pos + 4}
        y={y_pos}
        text={'Press `/` to code'}
        visible={props.showPlaceholder}
        style={{
          fontName: 'OpenSans',
          fontSize: 12,
          tint: colors.darkGrayNum,
          align: 'left',
          // maxWidth: 100,
        }}
      />
    </Container>
  );
};

export default CursorPixiReact;
