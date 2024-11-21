import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useToolUseMessages() {
  const getToolUsePrompt = useCallback((): ChatMessage[] => {
    return [
      {
        role: 'user',
        content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Include a concise explanation of the actions you are taking to respond to the user prompt. Never guess the answer itself, just the actions you are taking to respond to the user prompt and what the user can do next.\n

Don't include tool details in your response. Reply in layman's terms what actions you are taking.\n

Don't use multiple tools in a single response. You can use same tool multiple times in a single response. You should wait for the tool result message and then use another tool to complete the action.\n
          
${Object.entries(aiToolsSpec)
  .filter(([_, { internalTool }]) => !internalTool)
  .map(([name, { prompt }]) => `#${name}\n${prompt}`)
  .join('\n\n')}

All tool actions take place in the currently open sheet only.\n
`,
        contextType: 'toolUse',
      },
      {
        role: 'assistant',
        content:
          'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?',
        contextType: 'toolUse',
      },
    ];
  }, []);

  return { getToolUsePrompt };
}
