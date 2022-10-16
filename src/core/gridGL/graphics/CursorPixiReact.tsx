import { useCallback } from 'react';
import { colors } from '../../../theme/colors';
import { Graphics, Container } from '@inlet/react-pixi';
import { Viewport } from 'pixi-viewport';
interface CursorPixiReactProps {
  viewportRef?: React.MutableRefObject<Viewport | undefined>;
  x: number;
  y: number
  width: number;
  height: number;
  color?: number;
}

const CursorPixiReact = (props: CursorPixiReactProps) => {
  const { x, y, width, height, color } = props;

  const draw_outline = useCallback(
    (g) => {
      g.clear();

      if (color) g.lineStyle(1.5, color);
      else g.lineStyle(1.5, colors.cursorCell);

      g.drawRect(x, y, width, height);
      if (props.viewportRef?.current) {
        props.viewportRef.current.dirty = true;
      }
    },
      [x, y, props.viewportRef, width, height, color]
  );

  return (
    <Container>
      <Graphics draw={draw_outline}></Graphics>
    </Container>
  );
};

export default CursorPixiReact;
