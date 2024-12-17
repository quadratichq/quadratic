import { events } from '@/app/events/events';
import type { JsCellValuePos, SheetPos } from '@/app/quadratic-core-types';
import { useSubmitAIResearcherPrompt } from '@/app/ui/menus/AIResearcher/hooks/useSubmitAIResearcherPrompt';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useState } from 'react';

export type AIResearcherRequestArgs = {
  transactionId: string;
  sheetPos: string;
  query: string;
  refCellValues: string;
  cellsAccessedValues: JsCellValuePos[][][];
};

const GAP_BETWEEN_REQUESTS_MS = 1000;

export const AIResearcherRequestHandler = () => {
  const [queue, setQueue] = useState<AIResearcherRequestArgs[]>([]);
  const [waitingForGap, setWaitingForGap] = useState(false);
  const { submitPrompt } = useSubmitAIResearcherPrompt();

  useEffect(() => {
    const sendRequest = () => {
      if (queue.length === 0) return false;
      const [args, ...rest] = queue;

      const { transactionId, sheetPos, query, refCellValues, cellsAccessedValues } = args;
      const sheetPosStruct = JSON.parse(sheetPos) as SheetPos;
      submitPrompt({ query, refCellValues, sheetPos: sheetPosStruct, cellsAccessedValues }).then(
        ({ result, error }) => {
          const cellValues = result?.toolCallArgs?.cell_values;
          const researcherResponseStringified = JSON.stringify(result);
          quadraticCore.receiveAIResearcherResult({
            transactionId,
            sheetPos,
            cellValues,
            error,
            researcherResponseStringified,
          });
        }
      );

      setQueue(rest);
      setWaitingForGap(true);
      setTimeout(() => {
        setWaitingForGap(false);
      }, GAP_BETWEEN_REQUESTS_MS);
    };

    if (queue.length === 0) return;
    if (waitingForGap) return;

    sendRequest();
  }, [queue, submitPrompt, waitingForGap]);

  useEffect(() => {
    const addToQueue = (args: AIResearcherRequestArgs) => {
      setQueue((prev) => [...prev, args]);
    };

    events.on('requestAIResearcherResult', addToQueue);
    return () => {
      events.off('requestAIResearcherResult', addToQueue);
    };
  }, [submitPrompt]);

  return null;
};
