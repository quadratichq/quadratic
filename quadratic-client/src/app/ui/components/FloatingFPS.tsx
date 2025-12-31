import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { debugRustRendererLight } from '@/app/gridGL/helpers/debugPerformance';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { useFloatingDebugPosition } from '@/app/ui/components/useFloatingDebugPosition';
import { rustRendererWebWorker } from '@/app/web-workers/rustRendererWebWorker/rustRendererWebWorker';
import { memo, useEffect, useState } from 'react';

export const FloatingFPS = memo(() => {
  const { debugFlags } = useDebugFlags();
  const { leftHeading } = useHeadingSize();
  const bottomRem = useFloatingDebugPosition(0);
  const [rustFps, setRustFps] = useState(0);
  const [rustBackend, setRustBackend] = useState<'webgpu' | 'webgl' | undefined>(undefined);
  const showRustRenderer = debugFlags.getFlag('debugUseRustRenderer');

  // Poll Rust FPS and rendering state from SharedArrayBuffer
  useEffect(() => {
    if (!showRustRenderer) return;

    const interval = setInterval(() => {
      setRustFps(rustRendererWebWorker.fps);
      setRustBackend(rustRendererWebWorker.renderBackend);
      debugRustRendererLight(rustRendererWebWorker.isRendering);
    }, 16); // Poll at ~60fps for responsive light updates

    return () => clearInterval(interval);
  }, [showRustRenderer]);

  if (!debugFlags.getFlag('debugShowFPS')) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.5)] px-3 py-1.5 text-xs text-muted-foreground shadow-md"
      style={{ left: `${leftHeading + 5}px`, bottom: `${bottomRem * 0.25}rem` }}
    >
      {/* TS/Pixi renderer light */}
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
      <span>
        TS: <span className="debug-show-FPS">--</span>
      </span>
      {showRustRenderer && (
        <>
          {/* Rust renderer light */}
          <div
            className="debug-show-rust-renderer"
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              backgroundColor: '#00aa00',
            }}
          >
            &nbsp;
          </div>
          <span>
            {rustBackend === 'webgpu' ? 'WebGPU' : rustBackend === 'webgl' ? 'WebGL' : '--'}: {rustFps || '--'}
          </span>
        </>
      )}
      <span>FPS</span>
    </div>
  );
});
