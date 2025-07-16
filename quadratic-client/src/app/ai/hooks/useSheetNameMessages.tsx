import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSheetNameMessages() {
  const getSheetNamesContext = useCallback(async ({ sheetNames }: { sheetNames: string[] }): Promise<ChatMessage[]> => {
    if (sheetNames.length === 0) return [];

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
I have the following sheets (the sheet list) in the currently open file:\n
${sheetNames.join(', ')}\n`,
          },
        ],
        contextType: 'sheetNames',
      },
    ];
  }, []);

  return { getSheetNamesContext };
}
