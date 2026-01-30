import { events } from '@/app/events/events';
import {
  useSubmitAIAnalystPrompt,
  type SubmitAIAnalystPromptArgs,
} from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { memo, useEffect } from 'react';

/**
 * Component that listens for AI analyst events from vanilla JS code
 * and handles them using React hooks that have access to connections, model, etc.
 */
export const AIAnalystEventListener = memo(() => {
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  useEffect(() => {
    const handleSubmitPrompt = (args: SubmitAIAnalystPromptArgs) => {
      submitPrompt(args);
    };

    events.on('aiAnalystSubmitPrompt', handleSubmitPrompt);
    return () => {
      events.off('aiAnalystSubmitPrompt', handleSubmitPrompt);
    };
  }, [submitPrompt]);

  return null;
});
