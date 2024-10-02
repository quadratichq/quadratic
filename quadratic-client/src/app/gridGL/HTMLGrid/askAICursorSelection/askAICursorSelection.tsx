import { aiAssistantContextAtom } from '@/app/atoms/aiAssistantAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { Selection } from '@/app/quadratic-core-types';
import { AIIcon } from '@/shared/components/Icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

const ASK_AI_CURSOR_SELECTION_DELAY = 500;

export function AskAICursorSelection() {
  const setAIAssistantContext = useSetRecoilState(aiAssistantContextAtom);
  const [currentSheet, setCurrentSheet] = useState(sheets.current);
  const [selection, setSelection] = useState<Selection | undefined>();
  const [displayPos, setDisplayPos] = useState<Coordinate | undefined>();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  const updateSelection = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSelection(sheets.getRustSelection());
    }, ASK_AI_CURSOR_SELECTION_DELAY);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setAIAssistantContext((prev) => ({
        ...prev,
        cursorSelection: selection,
      }));
    },
    [selection, setAIAssistantContext]
  );

  useEffect(() => {
    const lastRect = selection?.rects?.at(-1);
    if (selection && lastRect) {
      const column = Math.max(Number(lastRect.min.x), Number(lastRect.max.x));
      const row = Math.min(Number(lastRect.min.y), Number(lastRect.max.y));
      const rectangle = sheets.getById(selection.sheet_id.id)?.getCellOffsets(column, row);
      if (rectangle) {
        setDisplayPos({
          x: rectangle.x + rectangle.width,
          y: rectangle.y,
        });
      } else {
        setDisplayPos(undefined);
      }
    } else {
      setDisplayPos(undefined);
    }
  }, [selection]);

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
    const handleCursorPosition = () => {
      setSelection(undefined);
      updateSelection();
    };

    events.on('cursorPosition', handleCursorPosition);
    return () => {
      events.off('cursorPosition', handleCursorPosition);
    };
  }, [updateSelection]);

  if (selection?.sheet_id.id !== currentSheet || displayPos === undefined) return null;

  return (
    <div
      className="ask-ai-cursor-selection-container pointer-events-auto z-10 cursor-pointer rounded border border-accent bg-accent"
      style={{
        position: 'absolute',
        left: `${displayPos.x}px`,
        top: `${displayPos.y}px`,
        fontSize: 'small',
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={handleClick}
    >
      <AIIcon className="mx-4 my-1" />
    </div>
  );
}
