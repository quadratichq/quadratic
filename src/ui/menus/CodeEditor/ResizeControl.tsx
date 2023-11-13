import { colors } from '../../../theme/colors';
import './ResizeControl.css';

interface ResizeControlProps {
  position: 'TOP' | 'LEFT';
  setState: (newStateValue: number) => void;
}

export function ResizeControl({ setState, position }: ResizeControlProps) {
  return (
    <div
      className={`resize-control resize-control--position-${position}`}
      data-position={position}
      style={{
        // @ts-expect-error typescript doesn't like us setting CSS custom properties
        '--resize-control-highlight': colors.quadraticPrimary,
        '--resize-control-background': colors.mediumGray,
      }}
      onMouseDown={(e) => {
        // set drag style via class
        const target = e.currentTarget;
        target.classList.add('resize-control--is-dragging');

        function mousemove(event_mousemove: globalThis.MouseEvent) {
          setState(
            position === 'LEFT'
              ? window.innerWidth - event_mousemove.x
              : // 51 is a bit of a magic number. It's the height of the CodeEditorHeader
                window.innerHeight - event_mousemove.y - 51
          );
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
