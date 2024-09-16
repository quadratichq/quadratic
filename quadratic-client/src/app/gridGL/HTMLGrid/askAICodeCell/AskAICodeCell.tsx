import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/AIAssistant/useSubmitAIAssistantPrompt';
import { AIIcon } from '@/shared/components/Icons';
import { useEffect, useState } from 'react';

const AI_ICON_SIZE = 14;

export function AskAICodeCell() {
  const [currentSheet, setCurrentSheet] = useState(sheets.current);
  const [loading, setLoading] = useState(false);
  const [sheetId, setSheetId] = useState<string | undefined>();
  const [pos, setPos] = useState<Coordinate | undefined>();
  const [displayPos, setDisplayPos] = useState<Coordinate | undefined>();

  const submitPrompt = useSubmitAIAssistantPrompt({ sheetId, pos });

  useEffect(() => {
    const updateSheet = (sheetId: string) => setCurrentSheet(sheetId);
    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, []);

  useEffect(() => {
    const update = (sheetId: string, pos: Coordinate) => {
      if (!loading) {
        setSheetId(sheetId);
        setPos(pos);
        const rectangle = sheets.getById(sheetId)?.getCellOffsets(pos.x, pos.y);
        if (rectangle) {
          setDisplayPos({
            x: rectangle.x + rectangle.width - AI_ICON_SIZE,
            y: rectangle.y + rectangle.height / 2 - AI_ICON_SIZE / 2,
          });
        } else {
          setDisplayPos(undefined);
        }
      }
    };

    events.on('askAICodeCell', update);
    return () => {
      events.off('askAICodeCell', update);
    };
  }, [loading]);

  useEffect(() => {
    if (sheetId !== undefined && pos !== undefined && !loading) {
      setLoading(true);
      submitPrompt({ userPrompt: 'Fix the error in the code cell', clearMessages: true }).then((result) => {
        // if false, context is not loaded, retry later
        if (!result) {
          setLoading(false);
        } else {
          setSheetId(undefined);
          setPos(undefined);
          setLoading(false);
        }
      });
    }
  }, [sheetId, pos, submitPrompt, loading]);

  if (sheetId !== currentSheet || sheetId === undefined || pos === undefined || displayPos === undefined) return null;

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
