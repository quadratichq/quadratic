import { colors } from '../../../theme/colors';
import './ResizeControl.css';

interface ResizeControlProps {
  position: 'HORIZONTAL' | 'VERTICAL';
  setState: (mouseEvent: globalThis.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function ResizeControl({ setState, position, style }: ResizeControlProps) {
  if (!style) {
    style = {};
  }

  return (
    <div
      className={`resize-control resize-control--position-${position}`}
      data-position={position}
      style={{
        ...style,
        // @ts-expect-error typescript doesn't like us setting CSS custom properties
        '--resize-control-highlight': colors.quadraticPrimary,
        '--resize-control-background': colors.mediumGray,
      }}
      onMouseDown={(e) => {
        // set drag style via class
        const target = e.currentTarget;
        target.classList.add('resize-control--is-dragging');

        function mousemove(mouseEvent: globalThis.MouseEvent) {
          setState(mouseEvent);
        }

        function mouseup() {
          window.removeEventListener('mousemove', mousemove);
          window.removeEventListener('mouseup', mouseup);

          // revert to non-drag style
          target.classList.remove('resize-control--is-dragging');
        }

        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
      }}
    ></div>
  );
}
