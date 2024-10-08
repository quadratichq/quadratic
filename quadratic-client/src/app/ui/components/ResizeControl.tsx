import './ResizeControl.css';

interface ResizeControlProps {
  disabled?: boolean;
  position: 'HORIZONTAL' | 'VERTICAL';
  setState: (mouseEvent: globalThis.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function ResizeControl({ disabled, setState, position, style }: ResizeControlProps) {
  return (
    <div
      className={`resize-control resize-control--position-${position} ${disabled ? 'resize-control--disabled' : ''}`}
      data-position={position}
      style={style}
      onMouseDown={(e) => {
        if (disabled) return;

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
