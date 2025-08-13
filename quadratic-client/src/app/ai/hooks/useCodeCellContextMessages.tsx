import { codeCellToMarkdown } from '@/app/ai/utils/codeCellToMarkdown';
import type { CodeCell } from '@/app/shared/types/codeCell';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCodeCellContextMessages() {
  const getCodeCellContext = useCallback(async ({ codeCell }: { codeCell: CodeCell }): Promise<ChatMessage[]> => {
    const { sheetId, pos } = codeCell;

    let text: string;
    try {
      text = await codeCellToMarkdown(sheetId, pos.x, pos.y);
    } catch (e) {
      text = `Error getting code cell markdown: ${e}`;
      console.error('Error getting code cell markdown in useCodeCellContextMessages', e);
    }

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
Currently, you are in a code cell that is being edited.
${text}
`,
          },
        ],
        contextType: 'codeCell',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `How can I help you?`,
          },
        ],
        contextType: 'codeCell',
      },
    ];
  }, []);

  return { getCodeCellContext };
}
