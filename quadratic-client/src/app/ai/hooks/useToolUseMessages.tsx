import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { AIModel, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useToolUseMessages() {
  const getToolUseMessages = useCallback((model: AIModel): ChatMessage[] => {
    return [
      {
        role: 'user',
        content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Include a concise explanation of the actions you are taking to respond to the user prompt.\n
          
${Object.entries(aiToolsSpec)
  .map(([name, { prompt }]) => `#${name}\n${prompt}`)
  .join('\n\n')}
`,
        contextType: 'toolUse',
      },
      {
        role: 'assistant',
        content:
          'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?',
        contextType: 'toolUse',
        model,
      },
    ];
  }, []);

  const getToolUsePrompt = useCallback(
    ({ model }: { model: AIModel }) => {
      return getToolUseMessages(model);
    },
    [getToolUseMessages]
  );

  return { getToolUsePrompt };
}
