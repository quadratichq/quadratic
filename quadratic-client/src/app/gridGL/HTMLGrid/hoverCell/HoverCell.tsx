import { showCodePeekAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { HtmlValidationMessage } from '@/app/gridGL/HTMLGrid/validations/HtmlValidationMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { pluralize } from '@/app/helpers/pluralize';
import { JsCodeCell, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { cn } from '@/shared/shadcn/utils';
import { Rectangle } from 'pixi.js';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import './HoverCell.css';

export const HOVER_CELL_FADE_IN_OUT_DELAY = 500;

export interface EditingCell {
  x: number;
  y: number;
  user: string;
  codeEditor: boolean;
}

export function HoverCell() {
  const showCodePeek = useRecoilValue(showCodePeekAtom);
  const [cell, setCell] = useState<JsRenderCodeCell | EditingCell | ErrorValidation | undefined>();
  const [offsets, setOffsets] = useState<Rectangle>(new Rectangle());
  const [delay, setDelay] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const hoveringRef = useRef(false);

  const timeoutId = useRef<NodeJS.Timeout | undefined>();
  const [allowPointerEvents, setAllowPointerEvents] = useState(false);

  const addPointerEvents = useCallback(() => {
    clearTimeout(timeoutId.current);
    setAllowPointerEvents(true);
  }, []);

  const removePointerEvents = useCallback(() => {
    clearTimeout(timeoutId.current);
    timeoutId.current = setTimeout(() => {
      setAllowPointerEvents(false);
      timeoutId.current = undefined;
    }, HOVER_CELL_FADE_IN_OUT_DELAY);
  }, []);

  const handleHover = useCallback(() => {
    addPointerEvents();
    setHovering(true);
    hoveringRef.current = true;
  }, [addPointerEvents]);

  const handleMouseLeave = useCallback(() => {
    removePointerEvents();
    setHovering(false);
    hoveringRef.current = false;
  }, [removePointerEvents]);

  const hideHoverCell = useCallback(() => {
    setCell(undefined);
    setHovering(false);
    hoveringRef.current = false;
    setDelay(false);
    setAllowPointerEvents(false);
    clearTimeout(timeoutId.current);
  }, []);

  const [text, setText] = useState<ReactNode>();
  const [onlyCode, setOnlyCode] = useState(false);
  const updateText = useCallback(async (cell: JsRenderCodeCell | EditingCell | ErrorValidation) => {
    const errorValidationCell = 'validationId' in cell ? cell : undefined;
    const renderCodeCell = 'language' in cell && 'state' in cell && 'spill_error' in cell ? cell : undefined;
    const editingCell = 'user' in cell && 'codeEditor' in cell ? cell : undefined;

    if (errorValidationCell) {
      const offsets = sheets.sheet.getCellOffsets(errorValidationCell.x, errorValidationCell.y);
      const validation = sheets.sheet.getValidationById(errorValidationCell.validationId);
      setOnlyCode(false);
      if (validation) {
        setText(
          <div className="relative">
            <HtmlValidationMessage
              column={errorValidationCell.x}
              row={errorValidationCell.y}
              offsets={offsets}
              validation={validation}
              hoverError
            />
          </div>
        );
      }
    } else if (renderCodeCell) {
      const spillError = renderCodeCell.spill_error;

      if (spillError) {
        setOnlyCode(false);
        setText(
          <>
            <div className="hover-cell-header">Spill Error</div>
            <div className="hover-cell-body">
              <div>Array output could not expand because it would overwrite existing values.</div>
              <div>
                To fix this, remove content in {pluralize('cell', spillError.length)}{' '}
                {spillError.map((pos, index) => (
                  <div key={`${pos.x},${pos.y}`}>
                    <code className="hover-cell-code">
                      ({String(pos.x)}, {String(pos.y)})
                    </code>
                    {index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'}
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      } else {
        const language = getLanguage(renderCodeCell.language);
        const sheetId = sheets.sheet.id;
        const { x, y } = renderCodeCell;
        const codeCell = await quadraticCore.getCodeCell(sheetId, x, y);

        if (renderCodeCell.state === 'RunError') {
          setOnlyCode(false);
          if (codeCell) {
            setText(<HoverCellRunError codeCell={codeCell} />);
          }
        } else {
          setOnlyCode(true);
          setText(
            <>
              <div className="hover-cell-header">{language} Code</div>
              <div className="code-body">{codeCell?.code_string}</div>
            </>
          );
        }
      }
    } else if (editingCell) {
      setOnlyCode(false);
      setText(
        <>
          <div className="hover-cell-header">Multiplayer Edit</div>
          <div className="hover-cell-body">
            {editingCell.codeEditor ? 'The code in this cell' : 'This cell'} is being edited by {editingCell.user}.
          </div>
        </>
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const addCell = (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => {
      setCell(cell);
      if (cell && !hoveringRef.current) {
        setOffsets(sheets.sheet.getCellOffsets(cell.x, cell.y));
        setDelay('validationId' in cell ? false : true);
        setLoading(true);
        updateText(cell);
        addPointerEvents();
      } else {
        removePointerEvents();
        setHovering(false);
        hoveringRef.current = false;
      }
    };
    events.on('hoverCell', addCell);
    return () => {
      events.off('hoverCell', addCell);
    };
  }, [addPointerEvents, removePointerEvents, updateText]);

  useEffect(() => {
    const remove = () => {
      hideHoverCell();
    };

    pixiApp.viewport.on('moved', remove);
    pixiApp.viewport.on('zoomed', remove);
    events.on('cursorPosition', remove);
    return () => {
      pixiApp.viewport.off('moved', remove);
      pixiApp.viewport.off('zoomed', remove);
      events.off('cursorPosition', remove);
    };
  }, [hideHoverCell]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);
  const { top, left } = usePositionCellMessage({ div, offsets });

  if (loading) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 box-border w-64 select-none rounded-md border bg-popover text-popover-foreground shadow-md outline-none',
        cell || hovering ? 'opacity-100' : 'opacity-0',
        allowPointerEvents ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      style={{
        top,
        left,
        visibility: !onlyCode || showCodePeek ? 'visible' : 'hidden',
        transition: delay ? `opacity 150ms linear ${HOVER_CELL_FADE_IN_OUT_DELAY}ms` : 'opacity 150ms linear',
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
      }}
      onMouseEnter={handleHover}
      onMouseMove={handleHover}
      onMouseLeave={handleMouseLeave}
    >
      <div className="p-4">{text}</div>
    </div>
  );
}

function HoverCellRunError({ codeCell }: { codeCell: JsCodeCell }) {
  const language = getLanguage(codeCell.language);

  return (
    <>
      <div className="hover-cell-header">
        <span>Run Error</span>
      </div>

      <div className="hover-cell-body">
        <div>There was an error running the code in this cell.</div>
        <div className="hover-cell-error-msg">{codeCell.std_err}</div>
      </div>

      <div className="hover-cell-header-space">{language} Code</div>
      <div className="code-body">{codeCell.code_string}</div>
    </>
  );
}
