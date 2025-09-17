import { codeCellToMarkdown } from '@/app/ai/utils/codeCellToMarkdown';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCodeCellContextMessages() {
  const getCodeCellContext = useCallback(async ({ codeCell }: { codeCell: CodeCell }): Promise<ChatMessage[]> => {
    const { sheetId, pos } = codeCell;

    let text: string;
    try {
      text = await codeCellToMarkdown(sheetId, pos.x, pos.y);
    } catch (e) {
      const a1Pos = xyToA1(pos.x, pos.y);
      const language = getConnectionKind(codeCell.language);
      text = `This is a new ${language} code cell located at ${a1Pos}.`;
      console.error('Error getting code cell markdown in useCodeCellContextMessages', e);
    }

    return [
      {
        role: 'user',
        content: [
          createTextContent(
            `Currently, you are in a code cell that is being edited.
${text}
`
          ),
        ],
        contextType: 'codeCell',
      },
      {
        role: 'assistant',
        content: [createTextContent(`How can I help you?`)],
        contextType: 'codeCell',
      },
    ];
  }, []);

  return { getCodeCellContext };
}
