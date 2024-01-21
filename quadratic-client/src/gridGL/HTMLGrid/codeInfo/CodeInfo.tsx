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
  const spillError = codeCell ? codeCell.spill_error : undefined;
  if (spillError) {
    text = (
      <>
        <div className="code-info-header">Spill Error</div>
        <div className="code-info-body">
          <div>Array output could not expand because it would overwrite existing values.</div>
          <div>
            To fix this, remove content in cell{spillError.length > 1 ? 's' : ''}{' '}
            {spillError.map(
              (pos, index) =>
                `(${pos.x}, ${pos.y})${
                  index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'
                }`
            )}
          </div>
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
    const updatePosition = () => {
      if (!codeCell) return;
      const div = ref.current;
      const textDiv = textRef.current;
      if (!div || !textDiv) return;
      const offsets = sheets.sheet.getCellOffsets(codeCell.x, codeCell.y);
      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();
      let transformOrigin: string;
      if (Math.abs(bounds.left - offsets.left) > Math.abs(bounds.right - offsets.right)) {
        // box to the left
        div.style.left = `${offsets.left}px`;
        textDiv.style.right = '0';
        textDiv.style.left = 'unset';
        transformOrigin = 'right';
      } else {
        // box to the right
        div.style.left = `${offsets.right}px`;
        textDiv.style.left = '0';
        textDiv.style.right = 'unset';
        transformOrigin = 'left';
      }
      if (Math.abs(bounds.top - offsets.top) < Math.abs(bounds.bottom - offsets.bottom)) {
        // box going down
        div.style.top = `${offsets.top}px`;
        textDiv.style.bottom = 'unset';
        transformOrigin += ' top';
      } else {
        // box going up
        div.style.top = `${offsets.bottom}px`;
        textDiv.style.bottom = `100%`;
        transformOrigin += ' bottom';
      }
      textDiv.style.transformOrigin = transformOrigin;
    };
    updatePosition();
    pixiApp.viewport.on('moved', updatePosition);
  }, [codeCell]);

  return (
    <div
      ref={ref}
      className="code-info-container"
      style={{
        position: 'absolute',
        visibility: codeCell ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={textRef}
          className={cn('w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none')}
          style={{ position: 'absolute' }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
