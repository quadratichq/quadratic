import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { AIIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

const SELECTION_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Create a chart', prompt: 'Create a chart from my selected data using Plotly in Python' },
  { label: 'Summarize data', prompt: 'Generate insights on my selected data using Python code' },
  { label: 'Tell me about this data', prompt: 'What kind of data is this, do not use code' },
  // { label: 'Add a column', prompt: 'Add a column to my selected data, use Python' },
  // { label: 'Add a row', prompt: 'Add a row to my selected data, use Python' },
  // {
  //   label: 'Perform EDA',
  //   prompt: 'Use Python to perform EDA on my selected data, do not create any charts in the process',
  // },
  { label: 'Clean data', prompt: 'Clean my selected data using Python' },
];

const ASK_AI_SELECTION_DELAY = 500;

export function AskAISelection() {
  const inlineEditorState = useRecoilValue(inlineEditorAtom);
  const [currentSheet, setCurrentSheet] = useState(sheets.current);
  const [selection, setSelection] = useState<Context['selection']>();
  const [displayPos, setDisplayPos] = useState<Coordinate | undefined>();
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  const { submitPrompt } = useSubmitAIAnalystPrompt();

  const showAskAISelection = useCallback(() => {
    const selection = sheets.getRustSelection();
    if (
      selection &&
      selection.rects?.length === 1 &&
      !(selection.rects[0].min.x === selection.rects[0].max.x && selection.rects[0].min.y === selection.rects[0].max.y)
    ) {
      const rect = selection.rects[0];
      const sheetRect: Context['selection'] = {
        sheet_id: selection.sheet_id,
        min: { x: Number(rect.min.x), y: Number(rect.min.y) },
        max: { x: Number(rect.max.x), y: Number(rect.max.y) },
      };
      const hasContent = pixiApp.cellsSheets.getById(selection.sheet_id.id)?.cellsLabels.hasCellInRect(rect);
      const column = Math.max(Number(rect.min.x), Number(rect.max.x));
      const row = Math.min(Number(rect.min.y), Number(rect.max.y));
      const rectangle = sheets.getById(selection.sheet_id.id)?.getCellOffsets(column, row);
      if (hasContent && rectangle && !inlineEditorState.visible) {
        setSelection(sheetRect);
        console.log('rectangle', rectangle);
        setDisplayPos({
          x: rectangle.x + rectangle.width,
          y: rectangle.y,
        });
      } else {
        setSelection(undefined);
        setDisplayPos(undefined);
      }
    } else {
      setSelection(undefined);
      setDisplayPos(undefined);
    }
  }, [inlineEditorState.visible]);

  const updateSelection = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setSelection(undefined);
    setDisplayPos(undefined);

    timeoutRef.current = setTimeout(() => {
      showAskAISelection();
    }, ASK_AI_SELECTION_DELAY);
  }, [showAskAISelection]);

  const handleSubmitPrompt = useCallback(
    (prompt: string) => {
      setLoading(true);
      submitPrompt({
        userPrompt: prompt,
        context: {
          sheets: [],
          currentSheet: sheets.sheet.name,
          selection,
        },
        clearMessages: true,
      })
        .catch(console.error)
        .finally(() => {
          setLoading(false);
          setSelection(undefined);
          setDisplayPos(undefined);
        });
    },
    [selection, submitPrompt]
  );

  useEffect(() => {
    const handleCursorPosition = () => {
      updateSelection();
    };

    events.on('cursorPosition', handleCursorPosition);
    return () => {
      events.off('cursorPosition', handleCursorPosition);
    };
  }, [updateSelection]);

  useEffect(() => {
    const updateSheet = (sheetId: string) => {
      setCurrentSheet(sheetId);
      updateSelection();
    };

    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, [updateSelection]);

  useEffect(() => {
    const handleHashContentChanged = (sheetId: string) => {
      if (currentSheet === sheetId) updateSelection();
    };

    events.on('hashContentChanged', handleHashContentChanged);
    return () => {
      events.off('hashContentChanged', handleHashContentChanged);
    };
  }, [currentSheet, updateSelection]);

  if (selection?.sheet_id.id !== currentSheet || displayPos === undefined) return null;

  return (
    <div
      className={`pointer-events-auto z-10 cursor-pointer select-none ${loading ? 'animate-pulse' : ''}`}
      style={{
        position: 'absolute',
        left: `${displayPos.x}px`,
        top: `${displayPos.y}px`,
        fontSize: 'small',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <DropdownMenu>
        <TooltipPopover label={'Chat with AI'}>
          <DropdownMenuTrigger asChild disabled={loading}>
            <Button variant="outline" size="icon" className="bg-background">
              <AIIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>

        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focusGrid();
          }}
        >
          {SELECTION_PROMPTS.map(({ label, prompt }) => (
            <DropdownMenuItem
              key={label}
              onClick={(e) => {
                e.stopPropagation();
                handleSubmitPrompt(prompt);
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
