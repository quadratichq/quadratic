import { useCallback } from 'react';
import { Graphics } from '@inlet/react-pixi';
import { Viewport } from 'pixi-viewport';
import { colors } from '../../../theme/colors';
import { Rectangle } from '../types/size';

interface CursorPixiReactProps {
  viewportRef?: React.MutableRefObject<Viewport | undefined>;
  multiCursor?: Rectangle;
  visible: boolean;
  color?: number;
}

const MultiCursorPixiReact = (props: CursorPixiReactProps) => {
  let { multiCursor, color, visible } = props;
  if (!color) color = colors.cursorCell;

  // render with pixi
  const draw_outline = useCallback(
    (g) => {
      g.clear();

      if (!visible || !multiCursor) return;

      g.lineStyle(1, color, 1, 0, true);
      g.beginFill(color, 0.1);
      g.drawRect(multiCursor.x, multiCursor.y, multiCursor.width, multiCursor.height);
      if (props.viewportRef?.current) {
        props.viewportRef.current.dirty = true;
      }
    },
    [multiCursor, props.viewportRef, color, visible]
  );

  return <Graphics draw={draw_outline}></Graphics>;
};

export default MultiCursorPixiReact;
