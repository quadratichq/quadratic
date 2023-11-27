import { colors } from '@/theme/colors';
import './HTMLResizeControl.css';

// todo: make this a generic component and combine it with ResizeControl for CodeEditor

interface ResizeControlProps {
  position: 'BOTTOM' | 'RIGHT';
}

// the actual class changing is handled in PointerHtmlCells.ts by changing the className programmatically
export function HTMLResizeControl({ position }: ResizeControlProps) {
  return (
    <div
      className={`resize-control resize-control--position-${position}`}
      style={{
        // @ts-expect-error typescript doesn't like us setting CSS custom properties
        '--resize-control-highlight': colors.quadraticPrimary,
        '--resize-control-background': colors.mediumGray,
        pointerEvents: 'none',
      }}
      // onPointerDown={(e) => {
      //   dispatchEvent(new CustomEvent('resize-html-pointer-down', { detail: e }));
      //   const target = e.currentTarget;
      //   target.classList.add('resize-control--is-dragging');
      // }}
      // onPointerUp={(e) => {
      //   dispatchEvent(new CustomEvent('resize-html-pointer-up', { detail: e }));
      //   const target = e.currentTarget;
      //   target.classList.remove('resize-control--is-dragging');
      // }}

      // onMouseDown={(e) => {
      //   // set drag style via class
      //   const target = e.currentTarget;
      //   target.classList.add('resize-control--is-dragging');

      //   // function mousemove(event_mousemove: globalThis.MouseEvent) {
      //   // setState(
      //   //   position === 'RIGHT'
      //   //     ? window.innerWidth - event_mousemove.x
      //   //     : // 51 is a bit of a magic number. It's the height of the CodeEditorHeader
      //   //       window.innerHeight - event_mousemove.y - 51
      //   // );
      //   // }

      //   function mouseup() {
      //     // window.removeEventListener('mousemove', mousemove);
      //     window.removeEventListener('mouseup', mouseup);

      //     // revert to non-drag style
      //     target.classList.remove('resize-control--is-dragging');
      //   }

      //   // window.addEventListener('mousemove', mousemove);
      //   window.addEventListener('mouseup', mouseup);
      // }}
    />
  );
}
