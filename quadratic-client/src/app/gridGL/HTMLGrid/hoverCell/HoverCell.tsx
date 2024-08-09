import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { pluralize } from '@/app/helpers/pluralize';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ReactNode, useEffect, useRef, useState } from 'react';
import './HoverCell.css';
import { ErrorValidation } from '../../cells/CellsSheet';
import { HtmlValidationMessage } from '../validations/HtmlValidationMessage';
import { usePositionCellMessage } from '../usePositionCellMessage';
import { Rectangle } from 'pixi.js';

export interface EditingCell {
  x: number;
  y: number;
  user: string;
  codeEditor: boolean;
}

export const HoverCell = () => {
  const { showCodePeek } = useGridSettings();
  const [cell, setCell] = useState<JsRenderCodeCell | EditingCell | ErrorValidation | undefined>();
  const [offsets, setOffsets] = useState<Rectangle>(new Rectangle());

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addCell = (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => {
      const div = ref.current;
      if (!div) return;
      if (!cell) {
        if (!div.classList.contains('hover-cell-fade-out')) {
          div.classList.add('hover-cell-fade-out');
          div.classList.remove('hover-cell-fade-in');
          div.classList.remove('hover-cell-fade-in-no-delay');
        }
      } else {
        if (!div.classList.contains('hover-cell-fade-in') && !div.classList.contains('hover-cell-fade-in-no-delay')) {
          if ('validationId' in cell || window.getComputedStyle(div).getPropertyValue('opacity') !== '0') {
            div.classList.add('hover-cell-fade-in-no-delay');
          } else {
            div.classList.add('hover-cell-fade-in');
          }
          div.classList.remove('hover-cell-fade-out');
        }
        setCell(cell);
        setOffsets(sheets.sheet.getCellOffsets(cell.x, cell.y));
      }
    };
    events.on('hoverCell', addCell);
    return () => {
      events.off('hoverCell', addCell);
    };
  }, []);

  useEffect(() => {
    const remove = () => {
      const div = ref.current;
      if (!div) return;
      if (!div.classList.contains('hover-cell-fade-out')) {
        div.classList.add('hover-cell-fade-out');
        div.classList.remove('hover-cell-fade-in');
        div.classList.remove('hover-cell-fade-in-no-delay');
      }
    };
    pixiApp.viewport.on('moved', remove);
    pixiApp.viewport.on('zoomed', remove);
    return () => {
      pixiApp.viewport.off('moved', remove);
      pixiApp.viewport.off('zoomed', remove);
    };
  }, []);

  const [text, setText] = useState<ReactNode>();
  const [onlyCode, setOnlyCode] = useState(false);
  useEffect(() => {
    const asyncFunction = async () => {
      if (cell && 'validationId' in cell) {
        const offsets = sheets.sheet.getCellOffsets(cell.x, cell.y);
        const validation = sheets.sheet.getValidationById(cell.validationId);
        if (validation) {
          const value = await quadraticCore.getDisplayCell(sheets.sheet.id, Number(cell.x), Number(cell.y));
          setText(
            <div className="relative">
              <HtmlValidationMessage
                column={cell.x}
                row={cell.y}
                offsets={offsets}
                validation={validation}
                hoverError={value}
              />
            </div>
          );
        }
        return;
      }
      const code = cell ? await quadraticCore.getCodeCell(sheets.sheet.id, Number(cell.x), Number(cell.y)) : undefined;
      const renderCodeCell = cell as JsRenderCodeCell | undefined;
      const language = getLanguage(renderCodeCell?.language);
      const editingCell = cell as EditingCell | undefined;
      const spillError = renderCodeCell ? renderCodeCell.spill_error : undefined;
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
      } else if (renderCodeCell?.state === 'RunError') {
        setOnlyCode(false);
        if (code) {
          setText(
            <>
              <div className="hover-cell-header">Run Error</div>
              <div className="hover-cell-body">
                <div>There was an error running the code in this cell.</div>
                <div className="hover-cell-error-msg">{code.std_err}</div>
              </div>
              <div className="hover-cell-header-space">{language} Code</div>
              <div className="code-body">{code?.code_string}</div>
            </>
          );
        }
      } else if (renderCodeCell?.state) {
        setOnlyCode(true);
        setText(
          <>
            <div className="hover-cell-header">{language} Code</div>
            <div className="code-body">{code?.code_string}</div>
          </>
        );
      } else if (editingCell?.user) {
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
    };
    asyncFunction();
  }, [cell]);

  const { top, left } = usePositionCellMessage({ div: ref.current, offsets, forceLeftOnInlineEditor: false });

  return (
    <div
      ref={ref}
      className="absolute z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground opacity-0 shadow-md outline-none"
      style={{ left, top, visibility: !onlyCode || showCodePeek ? 'visible' : 'hidden' }}
    >
      {text}
    </div>
  );
};
