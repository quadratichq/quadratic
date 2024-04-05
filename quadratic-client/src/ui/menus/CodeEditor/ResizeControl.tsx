import { colors } from '../../../theme/colors';
import './ResizeControl.css';

interface ResizeControlProps {
  position: 'TOP' | 'LEFT';
  setState: (mouseEvent: globalThis.MouseEvent) => void;
  min?: number;
}

export function ResizeControl({ setState, position, min }: ResizeControlProps) {
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

        function mousemove(mouseEvent: globalThis.MouseEvent) {
          setState(mouseEvent);
          // const newValue =
          //   position === 'LEFT'
          //     ? window.innerWidth - event_mousemove.x
          //     : // 25 is a bit of a magic number. It's the height of the CodeEditorHeader
          //       window.innerHeight - event_mousemove.y - 25;

          // // console.log(min, newValue);
          // // if (min && newValue > min) {
          // setState(min ? (newValue > min ? newValue : min) : newValue);
          // }
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
