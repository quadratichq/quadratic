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
    />
  );
}
