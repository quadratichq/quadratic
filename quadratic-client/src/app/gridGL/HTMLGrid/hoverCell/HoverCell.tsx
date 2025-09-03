import { aiAssistantLoadingAtom, aiAssistantWaitingOnMessageIndexAtom } from '@/app/atoms/codeEditorAtom';
import { showCodePeekAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { HtmlValidationMessage } from '@/app/gridGL/HTMLGrid/validations/HtmlValidationMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCodeCell, getLanguage } from '@/app/helpers/codeCellLanguage';
import { pluralize } from '@/app/helpers/pluralize';
import type { JsCodeCell, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { FixSpillError } from '@/app/ui/components/FixSpillError';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { Rectangle } from 'pixi.js';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

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

  const timeoutId = useRef<NodeJS.Timeout | undefined>(undefined);
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
  const updateText = useCallback(
    async (cell: JsRenderCodeCell | EditingCell | ErrorValidation) => {
      const errorValidationCell = 'validationId' in cell ? cell : undefined;
      const renderCodeCell = 'language' in cell && 'state' in cell && 'spill_error' in cell ? cell : undefined;
      const editingCell = 'user' in cell && 'codeEditor' in cell ? cell : undefined;

      if (errorValidationCell) {
        const offsets = sheets.sheet.getCellOffsets(errorValidationCell.x, errorValidationCell.y);
        const validation = sheets.sheet.getValidationById(errorValidationCell.validationId);
        setOnlyCode(false);
        if (validation) {
          setText(
            <div className="relative p-3">
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
        const sheetId = sheets.current;
        const { x, y } = renderCodeCell;
        const codeCell = await quadraticCore.getCodeCell(sheetId, x, y);
        if (renderCodeCell.state === 'SpillError') {
          setOnlyCode(false);
          if (codeCell) {
            setText(<HoverCellSpillError codeCell={codeCell} onClick={hideHoverCell} />);
          }
        } else {
          const language = getLanguage(renderCodeCell.language);
          if (renderCodeCell.state === 'RunError') {
            setOnlyCode(false);
            if (codeCell) {
              setText(<HoverCellRunError codeCell={codeCell} onClick={hideHoverCell} />);
            }
          } else {
            setOnlyCode(true);
            setText(
              <HoverCellDisplay title={language === 'Formula' ? 'Formula Code' : `${renderCodeCell.name} Code`}>
                <HoverCellDisplayCode language={language}>{codeCell?.code_string}</HoverCellDisplayCode>
              </HoverCellDisplay>
            );
          }
        }
      } else if (editingCell) {
        setOnlyCode(false);
        setText(
          <HoverCellDisplay title="Multiplayer edit">
            {editingCell.codeEditor ? 'The code in this cell' : 'This cell'} is being edited by {editingCell.user}.
          </HoverCellDisplay>
        );
      }

      setLoading(false);
    },
    [hideHoverCell]
  );

  useEffect(() => {
    const addCell = (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => {
      // don't show hover cell if the inline editor is showing at the same
      // location, unless it's a validation error
      if (cell && !(cell as ErrorValidation)?.validationId && inlineEditorHandler.getShowing(cell.x, cell.y)) {
        removePointerEvents();
        setHovering(false);
        hoveringRef.current = false;
        return;
      }

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
    return () => {
      pixiApp.viewport.off('moved', remove);
      pixiApp.viewport.off('zoomed', remove);
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
        'absolute z-50 box-border w-64 rounded-md border bg-popover text-popover-foreground shadow-md outline-none',
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
      {text}
    </div>
  );
}

function HoverCellRunError({ codeCell: codeCellCore, onClick }: { codeCell: JsCodeCell; onClick: () => void }) {
  const cell = useMemo(() => getCodeCell(codeCellCore.language), [codeCellCore.language]);
  const language = cell?.label;
  const x = Number(codeCellCore.x);
  const y = Number(codeCellCore.y);

  const codeCell: CodeCell = useMemo(
    () => ({
      sheetId: sheets.current,
      pos: { x, y },
      language: codeCellCore.language,
      lastModified: 0,
    }),
    [codeCellCore.language, x, y]
  );

  const aiAssistantLoading = useRecoilValue(aiAssistantLoadingAtom);
  const aiAssistantWaitingOnMessageIndex = useRecoilValue(aiAssistantWaitingOnMessageIndexAtom);

  const { submitPrompt } = useSubmitAIAssistantPrompt();

  return (
    <HoverCellDisplay
      title={language ? `${language} error` : 'Error'}
      isError
      actions={
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            trackEvent('[HoverCell].fixWithAI', {
              language: codeCellCore.language,
            });
            submitPrompt({
              content: [createTextContent('Fix the error in the code cell')],
              messageSource: 'FixWithAI',
              messageIndex: 0,
              codeCell,
            }).catch(console.error);
            onClick();
          }}
          disabled={aiAssistantLoading || aiAssistantWaitingOnMessageIndex !== undefined}
        >
          Fix with AI
        </Button>
      }
    >
      <HoverCellDisplayError>{codeCellCore.std_err}</HoverCellDisplayError>
      <HoverCellDisplayCode language={language}>{codeCellCore.code_string}</HoverCellDisplayCode>
    </HoverCellDisplay>
  );
}

function HoverCellSpillError({ codeCell: codeCellCore, onClick }: { codeCell: JsCodeCell; onClick: () => void }) {
  const x = Number(codeCellCore.x);
  const y = Number(codeCellCore.y);
  const codeCell: CodeCell = useMemo(
    () => ({
      sheetId: sheets.current,
      pos: { x, y },
      language: codeCellCore.language,
      lastModified: 0,
    }),
    [codeCellCore.language, x, y]
  );

  const evaluationResult = useMemo(
    () => (codeCellCore.evaluation_result ? JSON.parse(codeCellCore.evaluation_result) : {}),
    [codeCellCore.evaluation_result]
  );

  const spillError = codeCellCore.spill_error;
  if (!spillError) {
    return null;
  }

  return (
    <HoverCellDisplay
      title="Spill error"
      actions={<FixSpillError codeCell={codeCell} evaluationResult={evaluationResult} onClick={onClick} />}
      isError
    >
      <p>Array output could not expand because it would overwrite existing values.</p>

      <p>
        To fix: remove content in {pluralize('cell', spillError.length)}{' '}
        {spillError.map((pos, index) => (
          <span key={`${pos.x},${pos.y}`}>
            <code className="hover-cell-code">{xyToA1(Number(pos.x), Number(pos.y))}</code>

            {index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'}
          </span>
        ))}{' '}
        Or move this cell.
      </p>
    </HoverCellDisplay>
  );
}

function HoverCellDisplay({
  title,
  children,
  actions,
  isError,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  isError?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between">
        <span className={cn(isError ? 'text-destructive' : '')}>{title}</span>
        {actions && <div className="flex items-center gap-0.5">{actions}</div>}
      </div>
      <div className="flex flex-col gap-2 text-xs">{children}</div>
    </div>
  );
}

function HoverCellDisplayCode({ language, children }: { language?: string; children: string | undefined }) {
  if (!children) {
    return null;
  }

  const lines = children?.split('\n').length;
  return (
    <div
      className={cn(
        'flex max-h-48 flex-row overflow-hidden whitespace-pre rounded-md border-t border-border px-3 pt-2 font-mono text-[11px]',
        lines > 11 &&
          "-mb-3 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-16 after:bg-gradient-to-t after:from-background after:to-transparent after:content-['']"
      )}
    >
      <ol className="-ml-3 mr-3 text-right text-muted-foreground/50">
        {Array.from({ length: lines }).map((_, index) => (
          <li key={index}>{index + 1}</li>
        ))}
      </ol>
      <pre className={cn('relative whitespace-pre')}>{children}</pre>
    </div>
  );
}

function HoverCellDisplayError({ children }: { children: string | null }) {
  if (!children) {
    return null;
  }

  return <p className="break-words font-mono text-[11px] text-destructive">{children}</p>;
}
