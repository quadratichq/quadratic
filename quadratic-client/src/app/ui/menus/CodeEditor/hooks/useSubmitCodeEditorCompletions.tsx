import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { DEFAULT_CODE_EDITOR_COMPLETIONS_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';

interface HandleAICompletionProps {
  language: string;
  prefix: string;
  suffix: string;
  signal: AbortSignal;
}

export function useSubmitCodeEditorCompletions() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const handleAICompletion = useCallback(
    async ({ prefix, suffix, language, signal }: HandleAICompletionProps): Promise<string> => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: `
You are a code editor assistant, you are inside a code editor of code cell of spreadsheet.\n
The language of the code cell is ${language}.\n
You have to use the code_editor_completions tool and provide the text delta to be inserted at the cursor position.\n
The code before the cursor is:
\`\`\`${language}\n
${prefix}
\`\`\`

The code after the cursor is:
\`\`\`${language}\n
${suffix}
\`\`\`
`,
          contextType: 'userPrompt',
        },
      ];

      const response = await handleAIRequestToAPI({
        chatId: v4(),
        source: 'CodeEditorCompletions',
        modelKey: DEFAULT_CODE_EDITOR_COMPLETIONS_MODEL,
        messages,
        signal,
        useStream: false,
        toolName: AITool.CodeEditorCompletions,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      });

      const codeEditorCompletionsToolCall = response.toolCalls.find(
        (toolCall) => toolCall.name === AITool.CodeEditorCompletions
      );
      if (codeEditorCompletionsToolCall) {
        try {
          const argsObject = JSON.parse(codeEditorCompletionsToolCall.arguments);
          const args = aiToolsSpec[AITool.CodeEditorCompletions].responseSchema.parse(argsObject);
          return args.completion;
        } catch (error) {
          console.error('[useSubmitCodeEditorCompletions] toolCall: ', error);
        }
      }

      return '';
    },
    [handleAIRequestToAPI]
  );

  return { handleAICompletion };
}
