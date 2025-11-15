import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useSummaryContextMessages } from '@/app/ai/hooks/useSummaryContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_OPTIMIZE_PROMPT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';

export const useOptimizePrompt = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getSummaryContext } = useSummaryContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();

  const optimizePrompt = useCallback(
    async (originalPrompt: string): Promise<string> => {
      // Get the spreadsheet context with all tables and data
      const [summaryContext, visibleContext] = await Promise.all([getSummaryContext(), getVisibleContext()]);

      const userMessage: ChatMessage = {
        role: 'user',
        content: [
          createTextContent(
            `Restructure the following user prompt into clear, step-by-step bulleted instructions.\n
\nOriginal prompt: "${originalPrompt}"\n
\nYou have access to the full spreadsheet context with all tables, sheets, and data. Use it to make the instructions specific.\n
\nOutput MUST be a bulleted list with these sections:\n
- Task: [Detailed description of what to analyze/calculate, specifying which table/sheet and what aspects of the data to examine]\n
- Create: [What output format to generate - metrics, charts, tables, code, etc. If unclear from the prompt, recommend appropriate formats]\n
- [Any other relevant details like placement, constraints, or requirements]\n
\nBe specific about WHAT to analyze and WHERE the data is. If output format isn't clear, recommend metrics/charts/summaries as appropriate.\n
\nIMPORTANT: Use plain text only - NO markdown formatting like bold, italics, or any other formatting. Just use dashes and plain text.\n
\nUse the optimize_prompt tool to return the restructured bulleted list.`
          ),
        ],
        contextType: 'userPrompt',
      };

      // Include summary and visible context BEFORE the user message
      const messages: ChatMessage[] = [...summaryContext, ...visibleContext, userMessage];

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
    [handleAIRequestToAPI, getSummaryContext, getVisibleContext]
  );

  return { optimizePrompt };
};
