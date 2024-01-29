import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { cn } from '@/shadcn/utils';
import { useEffect, useRef, useState } from 'react';
import './HoverCell.css';

export interface EditingCell {
  x: number;
  y: number;
  user: string;
  codeEditor: boolean;
}

export const HoverCell = () => {
  const [cell, setCell] = useState<JsRenderCodeCell | EditingCell | undefined>();
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addCell = (e: any /* { detail: JsRenderCodeCell | EditingCell | undefined } */) => {
      const div = ref.current;
      if (!div) return;
      if (!e.detail) {
        if (!div.classList.contains('hover-cell-fade-out')) {
          div.classList.add('hover-cell-fade-out');
          div.classList.remove('hover-cell-fade-in');
          div.classList.remove('hover-cell-fade-in-no-delay');
        }
      } else {
        if (!div.classList.contains('hover-cell-fade-in') && !div.classList.contains('hover-cell-fade-in-no-delay')) {
          if (window.getComputedStyle(div).getPropertyValue('opacity') !== '0') {
            div.classList.add('hover-cell-fade-in-no-delay');
          } else {
            div.classList.add('hover-cell-fade-in');
          }
          div.classList.remove('hover-cell-fade-out');
        }
        setCell(e.detail);
      }
    };
    window.addEventListener('hover-cell', addCell);
    return () => window.removeEventListener('hover-cell', addCell);
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
  const code = cell ? sheets.sheet.getCodeCell(Number(cell.x), Number(cell.y)) : undefined;
  const renderCodeCell = cell as JsRenderCodeCell | undefined;
  const editingCell = cell as EditingCell | undefined;
  const spillError = renderCodeCell ? renderCodeCell.spill_error : undefined;
  if (spillError) {
    text = (
      <>
        <div className="hover-cell-header">Spill Error</div>
        <div className="hover-cell-body">
          <div>Array output could not expand because it would overwrite existing values.</div>
          <div>
            To fix this, remove content in cell{spillError.length > 1 ? 's' : ''}{' '}
            {spillError.map((pos, index) => (
              <>
                <code className="hover-cell-code">
                  ({String(pos.x)}, {String(pos.y)})
                </code>
                {index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'}
              </>
            ))}
          </div>
        </div>
      </>
    );
  } else if (renderCodeCell?.state === 'RunError') {
    if (code) {
      text = (
        <>
          <div className="hover-cell-header">Run Error</div>
          <div className="hover-cell-body">
            <div>There was an error running the code in this cell.</div>
            <div className="hover-cell-error-msg">{code.std_err}</div>
          </div>
          <div className="hover-cell-header-space">{renderCodeCell.language} Code</div>
          <div className="code-body">{code?.code_string}</div>
        </>
      );
    }
  } else if (renderCodeCell?.state) {
    text = (
      <>
        <div className="hover-cell-header">{renderCodeCell?.language} Code</div>
        <div className="code-body">{code?.code_string}</div>
      </>
    );
  } else if (editingCell?.user) {
    text = (
      <>
        <div className="hover-cell-header">Multiplayer Edit</div>
        <div className="hover-cell-body">
          {editingCell.codeEditor ? 'The code in this cell' : 'This cell'} is being edited by {editingCell.user}.
        </div>
      </>
    );
  }

  useEffect(() => {
    const updatePosition = () => {
      if (!cell) return;
      const div = ref.current;
      const textDiv = textRef.current;
      if (!div || !textDiv) return;
      const offsets = sheets.sheet.getCellOffsets(cell.x, cell.y);
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
    window.addEventListener('resize', updatePosition);

    return () => {
      pixiApp.viewport.off('moved', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [cell]);

  return (
    <div
      ref={ref}
      className="hover-cell-container"
      style={{
        position: 'absolute',
        visibility: cell ? 'visible' : 'hidden',
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
