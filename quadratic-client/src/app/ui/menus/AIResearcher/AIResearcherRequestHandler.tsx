import { events } from '@/app/events/events';
import { useSubmitAIResearcherPrompt } from '@/app/ui/menus/AIResearcher/hooks/useSubmitAIResearcherPrompt';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect } from 'react';

export const AIResearcherRequestHandler = () => {
  const { submitPrompt } = useSubmitAIResearcherPrompt();

  useEffect(() => {
    const handleRequestAIResearcherResult = (
      transactionId: string,
      sheetPos: string,
      query: string,
      refCellValues: string
    ) => {
      submitPrompt({ query, refCellValues }).then(({ result, error }) => {
        const cell_value = result?.toolCallArgs?.cell_value;
        const researcher_response_stringified = JSON.stringify(result);
        quadraticCore.receiveAIResearcherResult({
          transactionId,
          sheetPos,
          cell_value,
          error,
          researcher_response_stringified,
        });
      });
    };

    events.on('requestAIResearcherResult', handleRequestAIResearcherResult);
    return () => {
      events.off('requestAIResearcherResult', handleRequestAIResearcherResult);
    };
  }, [submitPrompt]);

  return null;
};
