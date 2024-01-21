import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { cn } from '@/shadcn/utils';
import { colors } from '@/theme/colors';
import { useEffect, useRef, useState } from 'react';
import './CodeInfo.css';

export const CodeInfo = () => {
  const [codeCell, setCodeCell] = useState<JsRenderCodeCell | undefined>();
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addError = (e: any /* { detail: CodeCell } */) => {
      const div = ref.current;
      if (!div) return;
      if (!e.detail) {
        if (!div.classList.contains('code-info-fade-out')) {
          div.classList.add('code-info-fade-out');
          div.classList.remove('code-info-fade-in');
          div.classList.remove('code-info-fade-in-no-delay');
        }
      } else {
        if (!div.classList.contains('code-info-fade-in') && !div.classList.contains('code-info-fade-in-no-delay')) {
          if (window.getComputedStyle(div).getPropertyValue('opacity') !== '0') {
            div.classList.add('code-info-fade-in-no-delay');
          } else {
            div.classList.add('code-info-fade-in');
          }
          div.classList.remove('code-info-fade-out');
        }
        setCodeCell(e.detail);
      }
    };
    window.addEventListener('overlap-code-info', addError);
    return () => window.removeEventListener('overlap-code-info', addError);
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
        <div className="code-info-header">Spill Error</div>
        <div className="code-info-body">
          <div>Array output could not expand because it would overwrite existing values.</div>
          <div>Select the cell and remove the red highlighted values to expand it.</div>
        </div>
      </>
    );
  } else if (codeCell?.state === 'RunError') {
    if (code) {
      text = (
        <>
          <div className="code-info-header">Run Error</div>
          <div className="code-info-body">
            <div>There was an error running the code in this cell.</div>
            <div style={{ color: colors.error }}>{code.std_err}</div>
          </div>
          <div className="code-info-header-space">{codeCell.language} Code</div>
          <div className="code-body">{code?.code_string}</div>
        </>
      );
    }
  } else if (codeCell) {
    text = (
      <>
        <div className="code-info-header">{codeCell.language} Code</div>
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
      className="code-info-container"
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
