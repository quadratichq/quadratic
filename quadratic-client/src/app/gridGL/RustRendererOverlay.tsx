/**
 * RustRendererOverlay - Debug overlay that shows the Rust renderer on top of Pixi.js
 *
 * This component is only rendered when the `debugUseRustRenderer` debug flag is enabled.
 * It creates a canvas that is transferred to the rust renderer worker as an OffscreenCanvas.
 */

import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { rustRendererWebWorker } from '@/app/web-workers/rustRendererWebWorker/rustRendererWebWorker';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

type OpacityMode = 'half' | 'rust' | 'ts';

export const RustRendererOverlay = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<string | null>(null);
  const [opacityMode, setOpacityMode] = useState<OpacityMode>('half');

  const getOpacity = () => {
    switch (opacityMode) {
      case 'rust':
        return 1;
      case 'ts':
        return 0;
      case 'half':
      default:
        return 0.5;
    }
  };

  // Use reactive debug flags hook
  const { debugFlags } = useDebugFlags();
  const isEnabled = debugFlags.getFlag('debugUseRustRenderer');

  const initRenderer = useCallback(async () => {
    if (!canvasRef.current || initialized) return;

    try {
      console.log('[RustRendererOverlay] Initializing renderer...');
      await quadraticCore.initRustRenderer(canvasRef.current);

      // Send sheet offsets to the rust renderer
      console.log('[RustRendererOverlay] Sending sheet offsets to rust renderer...');
      quadraticCore.sendAllSheetOffsetsToRustRenderer();

      setInitialized(true);
      setBackend('ready');
      console.log('[RustRendererOverlay] Renderer initialized successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[RustRendererOverlay] Failed to initialize:', err);
    }
  }, [initialized]);

  useEffect(() => {
    if (isEnabled && canvasRef.current && !initialized && !error) {
      // Small delay to ensure the core worker has the port ready
      const timer = setTimeout(initRenderer, 500);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, initRenderer, initialized, error]);

  // Handle resize
  useEffect(() => {
    if (!isEnabled || !canvasRef.current || !initialized) return;

    const canvas = canvasRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          console.log(`[RustRendererOverlay] resize: ${width}x${height}`);
          rustRendererWebWorker.resize(width, height);
        }
      }
    });

    resizeObserver.observe(canvas);

    // Send initial resize
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      rustRendererWebWorker.resize(rect.width, rect.height);
    }

    return () => resizeObserver.disconnect();
  }, [isEnabled, initialized]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none', // Let mouse events pass through to Pixi
        zIndex: 10, // On top of Pixi canvas
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          opacity: getOpacity(),
        }}
      />
      {/* Debug status indicator and opacity controls */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'auto',
        }}
      >
        {/* Status */}
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: error ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 128, 0, 0.8)',
            color: 'white',
            fontSize: 12,
            fontFamily: 'monospace',
            borderRadius: 4,
          }}
        >
          {error ? `Error: ${error}` : `Rust: ${initialized ? backend || 'ready' : 'loading...'}`}
        </div>
        {/* Opacity controls */}
        {initialized && !error && (
          <div
            style={{
              display: 'flex',
              gap: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: 4,
              padding: 2,
            }}
          >
            <button
              onClick={() => setOpacityMode('ts')}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: opacityMode === 'ts' ? 'bold' : 'normal',
                backgroundColor: opacityMode === 'ts' ? '#4a90d9' : 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              TS
            </button>
            <button
              onClick={() => setOpacityMode('half')}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: opacityMode === 'half' ? 'bold' : 'normal',
                backgroundColor: opacityMode === 'half' ? '#4a90d9' : 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              50/50
            </button>
            <button
              onClick={() => setOpacityMode('rust')}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: opacityMode === 'rust' ? 'bold' : 'normal',
                backgroundColor: opacityMode === 'rust' ? '#4a90d9' : 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              Rust
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

RustRendererOverlay.displayName = 'RustRendererOverlay';
