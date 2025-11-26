import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { memo } from 'react';

export const FloatingFPS = memo(() => {
  const { debugFlags } = useDebugFlags();
  const { leftHeading } = useHeadingSize();

  if (!debugFlags.getFlag('debugShowFPS')) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute bottom-12 z-50 flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.5)] px-3 py-1.5 text-xs text-muted-foreground shadow-md"
      style={{ left: `${leftHeading + 5}px` }}
    >
      <div
        className="debug-show-renderer"
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
        }}
      >
        &nbsp;
      </div>
      <span className="debug-show-FPS">--</span> FPS
    </div>
  );
});
