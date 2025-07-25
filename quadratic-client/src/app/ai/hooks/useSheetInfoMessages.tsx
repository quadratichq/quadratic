import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSheetInfoMessages() {
  const getSheetInfoContext = useCallback(async ({ sheets }: { sheets: Sheet[] }): Promise<ChatMessage[]> => {
    if (sheets.length === 0) return [];

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
I have the following sheets (the sheet list) in the currently open file:\n
${sheets.map((sheet) => sheet.name).join(', ')}\n

The sheet names have the following colors (if they are colored):\n
${sheets.map((sheet) => `${sheet.name} is ${sheet.color ?? 'not colored'}`).join('; ')}`,
          },
        ],
        contextType: 'sheetNames',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `I understand the sheet names and colors, I will reference it to answer following messages. How can I help you?`,
          },
        ],
        contextType: 'sheetNames',
      },
    ];
  }, []);

  return { getSheetInfoContext };
}
