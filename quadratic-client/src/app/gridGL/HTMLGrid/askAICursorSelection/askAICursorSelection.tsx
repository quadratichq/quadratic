import { aiAssistantContextAtom } from '@/app/atoms/aiAssistantAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Selection } from '@/app/quadratic-core-types';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/AIAssistant/hooks/useSubmitAIAssistantPrompt';
import { AIIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

const CURSOR_SELECTION_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Summarize data', prompt: 'Summarize my selected data' },
  { label: 'Create a chart', prompt: 'Create a chart from my selected data' },
];

const ASK_AI_CURSOR_SELECTION_DELAY = 500;

export function AskAICursorSelection() {
  const setAIAssistantContext = useSetRecoilState(aiAssistantContextAtom);
  const [currentSheet, setCurrentSheet] = useState(sheets.current);
  const [selection, setSelection] = useState<Selection | undefined>();
  const [displayPos, setDisplayPos] = useState<Coordinate | undefined>();
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  const { submitPrompt } = useSubmitAIAssistantPrompt();

  const showAskAICursorSelection = useCallback(() => {
    const selection = sheets.getRustSelection();
    if (
      selection &&
      selection.rects?.length === 1 &&
      !(selection.rects[0].min.x === selection.rects[0].max.x && selection.rects[0].min.y === selection.rects[0].max.y)
    ) {
      const rect = selection.rects[0];
      const column = Math.max(Number(rect.min.x), Number(rect.max.x));
      const row = Math.min(Number(rect.min.y), Number(rect.max.y));
      const rectangle = sheets.getById(selection.sheet_id.id)?.getCellOffsets(column, row);
      if (rectangle) {
        setSelection(selection);
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
  }, []);

  const updateSelection = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setDisplayPos(undefined);
    setSelection(undefined);
    setAIAssistantContext((prev) => ({
      ...prev,
      cursorSelection: undefined,
    }));

    timeoutRef.current = setTimeout(() => {
      showAskAICursorSelection();
    }, ASK_AI_CURSOR_SELECTION_DELAY);
  }, [setAIAssistantContext, showAskAICursorSelection]);

  const handleSubmitPrompt = useCallback(
    (prompt: string) => {
      setLoading(true);
      submitPrompt({ userPrompt: prompt, clearMessages: true, selection })
        .catch(console.error)
        .finally(() => {
          setLoading(false);
          setDisplayPos(undefined);
          setSelection(undefined);
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

  if (selection?.sheet_id.id !== currentSheet || displayPos === undefined) return null;

  return (
    <div
      className={`ask-ai-cursor-selection-container pointer-events-auto z-10 cursor-pointer select-none rounded border border-accent bg-accent ${
        loading ? 'animate-pulse' : ''
      }`}
      style={{
        position: 'absolute',
        left: `${displayPos.x}px`,
        top: `${displayPos.y}px`,
        fontSize: 'small',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <DropdownMenu onOpenChange={() => focusGrid()}>
        <DropdownMenuTrigger asChild disabled={loading}>
          <div className="flex items-center px-2 py-1">
            <AIIcon />
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <div className="relative select-none items-center rounded-sm p-2 text-base font-bold">
            Take action on you selected data
          </div>

          {CURSOR_SELECTION_PROMPTS.map(({ label, prompt }) => (
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
