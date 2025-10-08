import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_OPTIMIZE_PROMPT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';

export const useOptimizePrompt = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const optimizePrompt = useCallback(
    async (originalPrompt: string): Promise<string> => {
      if (!originalPrompt.trim()) {
        return '';
      }

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            createTextContent(
              `Restructure the following user prompt to follow this template:\n
1. What do you want performed (the task/analysis)\n
2. What data do you want to reference (use specific table/sheet names from the spreadsheet context when the user's intent is clear)\n
3. Where to place it (location preference, or default to "an open location right of existing data")\n
\nOriginal prompt: "${originalPrompt}"\n
\nYou have access to the full spreadsheet context. Use it to make the prompt more specific by referencing actual table names, sheet names, or data locations when appropriate.\n
\nTransform this into a clear, natural-sounding prompt that answers all three questions. If the original prompt doesn't specify where to place results, add "and place it in an open location right of existing data" at the end.\n
\nUse the optimize_prompt tool to return the restructured version.`
            ),
          ],
          contextType: 'userPrompt',
        },
      ];

      const abortController = new AbortController();
      try {
        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'OptimizePrompt',
          messageSource: 'OptimizePrompt',
          modelKey: DEFAULT_OPTIMIZE_PROMPT_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          toolName: AITool.OptimizePrompt,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: true,
        });

        const optimizePromptToolCall = response.toolCalls.find((toolCall) => toolCall.name === AITool.OptimizePrompt);
        if (optimizePromptToolCall) {
          try {
            const argsObject = JSON.parse(optimizePromptToolCall.arguments);
            const args = aiToolsSpec[AITool.OptimizePrompt].responseSchema.parse(argsObject);
            return args.optimized_prompt;
          } catch (error) {
            console.error('[useOptimizePrompt] toolCall parse error: ', error);
          }
        }
      } catch (error) {
        console.error('[useOptimizePrompt] request error: ', error);
      }

      // Return original prompt if optimization fails
      return originalPrompt;
    },
    [handleAIRequestToAPI]
  );

  return { optimizePrompt };
};
