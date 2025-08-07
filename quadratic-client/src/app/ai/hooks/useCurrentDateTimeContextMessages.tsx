import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCurrentDateTimeContextMessages() {
  const getCurrentDateTimeContext = useCallback((): ChatMessage[] => {
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `The current date is ${new Date().toString()}.`,
          },
        ],
        contextType: 'currentDate',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `I understand the current date and user locale.`,
          },
        ],
        contextType: 'currentDate',
      },
    ];
  }, []);

  return { getCurrentDateTimeContext };
}
