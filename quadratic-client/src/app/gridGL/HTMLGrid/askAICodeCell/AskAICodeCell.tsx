import { CodeCell } from '@/app/atoms/aiAssistantAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/AIAssistant/useSubmitAIAssistantPrompt';
import { AIIcon } from '@/shared/components/Icons';
import { useCallback, useEffect, useState } from 'react';

const AI_ICON_SIZE = 14;

export function AskAICodeCell() {
  const [currentSheet, setCurrentSheet] = useState(sheets.current);
  const [loading, setLoading] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [displayPos, setDisplayPos] = useState<Coordinate | undefined>();

  const submitPrompt = useSubmitAIAssistantPrompt();

  const askAI = useCallback(
    (codeCell: CodeCell) => {
      if (loading) return;

      const { sheetId, pos } = codeCell;
      setSheetId(sheetId);
      const rectangle = sheets.getById(sheetId)?.getCellOffsets(pos.x, pos.y);
      if (rectangle) {
        setDisplayPos({
          x: rectangle.x + rectangle.width - AI_ICON_SIZE,
          y: rectangle.y + rectangle.height / 2 - AI_ICON_SIZE / 2,
        });
        setLoading(true);
        submitPrompt({ codeCell, userPrompt: 'Fix the error in the code cell', clearMessages: true })
          .catch(console.error)
          .finally(() => {
            setLoading(false);
            setDisplayPos(undefined);
          });
      } else {
        setDisplayPos(undefined);
        setLoading(false);
      }
    },
    [loading, submitPrompt]
  );

  useEffect(() => {
    const updateSheet = (sheetId: string) => setCurrentSheet(sheetId);
    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, []);

  useEffect(() => {
    events.on('askAICodeCell', askAI);
    return () => {
      events.off('askAICodeCell', askAI);
    };
  }, [askAI]);

  if (sheetId !== currentSheet || displayPos === undefined || !loading) return null;

  return (
    <div className="ai-ask-code-cell-container pointer-events-none relative">
      <AIIcon
        style={{
          position: 'absolute',
          left: `${displayPos.x}px`,
          top: `${displayPos.y}px`,
          fontSize: 'small',
        }}
      />
    </div>
  );
}
