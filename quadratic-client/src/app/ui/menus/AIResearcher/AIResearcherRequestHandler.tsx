import { events } from '@/app/events/events';
import { useSubmitAIResearcherPrompt } from '@/app/ui/menus/AIResearcher/hooks/useSubmitAIResearcherPrompt';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect } from 'react';

export const AIResearcherRequestHandler = () => {
  const { submitPrompt } = useSubmitAIResearcherPrompt();

  useEffect(() => {
    const handleRequestAIResearcherResult = (transactionId: string, query: string, refCellValues: string) => {
      submitPrompt({ query, refCellValues }).then(({ result, error }) => {
        quadraticCore.responseAIResearcherResult(transactionId, result, error);
      });
    };

    events.on('requestAIResearcherResult', handleRequestAIResearcherResult);
    return () => {
      events.off('requestAIResearcherResult', handleRequestAIResearcherResult);
    };
  }, [submitPrompt]);

  return null;
};
