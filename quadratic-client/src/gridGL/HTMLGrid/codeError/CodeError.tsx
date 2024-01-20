import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { cn } from '@/shadcn/utils';
import { colors } from '@/theme/colors';
import { useEffect, useRef, useState } from 'react';
import './CodeError.css';

export const CodeError = () => {
  const [codeCell, setCodeCell] = useState<JsRenderCodeCell | undefined>();
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addError = (e: any /* { detail: CodeCell } */) => {
      if (!e.detail) {
        if (ref.current && !ref.current.classList.contains('code-error-fade-out')) {
          ref.current?.classList.add('code-error-fade-out');
          ref.current?.classList.remove('code-error-fade-in');
        }
      } else {
        if (ref.current && !ref.current.classList.contains('code-error-fade-in')) {
          if (ref.current?.style.opacity !== '0') {
            ref.current?.classList.add('code-error-fade-in-no-delay');
          } else {
            ref.current?.classList.add('code-error-fade-in');
          }
          ref.current?.classList.remove('code-error-fade-out');
        }
        setCodeCell(e.detail);
      }
    };
    window.addEventListener('overlap-code-error', addError);
    return () => window.removeEventListener('overlap-code-error', addError);
  }, []);

  const offsets = codeCell ? sheets.sheet.getCellOffsets(Number(codeCell.x), Number(codeCell.y)) : { x: 0, y: 0 };

  useEffect(() => {
    const changeZoom = () => {
      if (textRef.current) {
        textRef.current.style.transform = `scale(${1 / pixiApp.viewport.scale.x})`;
      }
    };
    pixiApp.viewport.on('zoomed', changeZoom);
    return () => {
      pixiApp.viewport.off('zoomed', changeZoom);
    };
  }, []);

  let text: JSX.Element | undefined;
  const code = codeCell ? sheets.sheet.getCodeCell(Number(codeCell.x), Number(codeCell.y)) : undefined;
  if (codeCell?.state === 'SpillError') {
    text = (
      <>
        <div className="code-error-header">Spill Error</div>
        <div className="code-error-body">
          <div>Array output could not expand because it would overwrite existing values.</div>
          <div>Select the cell and remove the red highlighted values to expand it.</div>
        </div>
      </>
    );
  } else if (codeCell?.state === 'RunError') {
    if (code) {
      text = (
        <>
          <div className="code-error-header">Run Error</div>
          <div className="code-error-body">
            <div>There was an error running the code in this cell.</div>
            <div style={{ color: colors.error }}>{code.std_err}</div>
          </div>
          <div className="code-error-header-space">{codeCell.language} Code</div>
          <div className="code-body">{code?.code_string}</div>
        </>
      );
    }
  } else if (codeCell) {
    text = (
      <>
        <div className="code-error-header">{codeCell.language} Code</div>
        <div className="code-body">{code?.code_string}</div>
      </>
    );
  }

  useEffect(() => {
    const viewport = pixiApp.viewport;
    viewport.on('zoom', () => {});
  }, []);

  return (
    <div
      ref={ref}
      className="code-error-container"
      style={{
        position: 'absolute',
        left: offsets.x,
        top: offsets.y,
        visibility: codeCell ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={textRef}
          className={cn('w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none')}
          style={{
            position: 'absolute',
            right: 0,
            transformOrigin: `calc(${codeCell?.x ?? 0}px + 100%) ${codeCell?.y ?? 0}`,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
