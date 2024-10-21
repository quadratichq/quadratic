import { AI_TOOLS } from '@/app/ai/tools/aiTools';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useToolUseMessages() {
  const getToolUseMessages = useCallback(
    (model: AnthropicModel | OpenAIModel, cursorPosition: Coordinate): (UserMessage | AIMessage)[] => {
      return [
        {
          role: 'user',
          content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Include a concise explanation of the actions you are taking to respond to the user prompt.\n
          
${Object.entries(AI_TOOLS)
  .map(([name, { prompt }]) => `#${name}\n${prompt}`)
  .join('\n\n')}

My cursor is on cell x:${cursorPosition.x} and y:${cursorPosition.y}.\n 
`,
          internalContext: true,
          contextType: 'toolUse',
        },
        {
          role: 'assistant',
          content:
            'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?',
          model,
          internalContext: true,
          contextType: 'toolUse',
        },
      ];
    },
    []
  );

  const getToolUsePrompt = useCallback(
    ({ model }: { model: AnthropicModel | OpenAIModel }) => {
      const { cursorPosition } = sheets.sheet.cursor;
      return getToolUseMessages(model, cursorPosition);
    },
    [getToolUseMessages]
  );

  return { getToolUsePrompt };
}
