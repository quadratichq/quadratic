import { sheets } from '@/grid/controller/Sheets';
import { JsRenderCodeCellState } from '@/quadratic-core/types';
import { colors } from '@/theme/colors';
import { useEffect, useState } from 'react';
import { Coordinate } from '../../types/size';
import './CodeError.css';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';

interface CodeErrorInterface {
  location: Coordinate;
  type: JsRenderCodeCellState;
  x?: number;
  y?: number;
}

const FADE_TIME = 500;

export const CodeError = () => {
  const [error, setError] = useState<CodeErrorInterface | undefined>();
  const [remove, setRemove] = useState(0);
  const [overDialog, setOverDialog] = useState(false);

  useEffect(() => {
    const addError = (e: any /* { detail: CodeErrorInterface } */) => {
      if (!e.detail) {
        if (error && !remove) {
          const timeout = window.setTimeout(() => {
            setRemove(0);
            setError(undefined);
          }, FADE_TIME);
          setRemove(timeout);
        }
      } else {
        setError((error) => {
          if (
            !remove &&
            error &&
            error.location.x === e.detail.location.x &&
            error.location.y === e.detail.location.y
          ) {
            return error;
          }
          const offsets = sheets.sheet.getCellOffsets(e.detail.location.x, e.detail.location.y);
          return { ...e.detail, x: offsets.x, y: offsets.y };
        });
        setRemove((remove) => {
          if (remove) {
            window.clearTimeout(remove);
          }
          return 0;
        });
      }
    };
    window.addEventListener('overlap-code-error', addError);
    return () => window.removeEventListener('overlap-code-error', addError);
  }, [remove, error]);

  let text: JSX.Element | undefined;
  if (error?.type === 'SpillError') {
    text = (
      <>
        <div className="code-error-header">Spill Error</div>
        <div className="code-error-body">
          <div>Array output could not expand because it would overwrite existing values.</div>
          <div>Select the cell and remove the red highlighted values to expand it.</div>
        </div>
      </>
    );
  } else if (error?.type === 'RunError') {
    const code = sheets.sheet.getCodeCell(error.location.x, error.location.y);
    if (code) {
      text = (
        <>
          <div className="code-error-header">Run Error</div>
          <div className="code-error-body">
            <div>There was an error running the code in this cell.</div>
            <div style={{ color: colors.error }}>{code.std_err}</div>
          </div>
        </>
      );
    }
  }

  useEffect(() => {
    const viewport = pixiApp.viewport;
    viewport.on('zoom', () => {});
  }, []);

  return (
    <div
      className={`code-error ${error && !remove ? 'code-error-fade-in' : error && remove ? 'code-error-fade-out' : ''}`}
      style={{
        position: 'absolute',
        visibility: error ? 'visible' : 'hidden',
        left: error?.x,
        top: error?.y,
        pointerEvents: 'auto',
      }}
      onPointerEnter={() => {
        if (error && remove) {
          window.clearTimeout(remove);
          setRemove(0);
          setOverDialog(true);
        }
      }}
      onPointerLeave={() => {
        if (overDialog) {
          const timeout = window.setTimeout(() => {
            setRemove(0);
            setError(undefined);
          }, FADE_TIME);
          setOverDialog(false);
          setRemove(timeout);
        }
      }}
    >
      <div className="code-error" style={{ border: `1px solid ${colors.error}` }}>
        {text}
      </div>
    </div>
  );
};
