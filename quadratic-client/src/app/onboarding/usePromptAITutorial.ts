/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useState } from 'react';

const CATEGORY = 'prompt-ai';
type State = 'not-started' | 'ai-open' | 'add-prompt';

export const usePromptAITutorial = () => {
  const [state, setState] = useState<State>('not-started');

  const start = useCallback(() => {
    setState('ai-open');
  }, []);

  const addPrompt = useCallback(() => {
    setState('add-prompt');
  }, []);

  return useCallback(
    (repeat: boolean = false) => {
      if (state === 'not-started') {
        start();
      }
      console.log('TODO', CATEGORY, 'repeat:', repeat);
    },
    [start, state]
  );
};
