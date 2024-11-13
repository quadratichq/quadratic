import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getMessagesForModel } from '@/app/ai/tools/message.helper';
import { useAIResearcherMessagePrompt } from '@/app/ui/menus/AIResearcher/hooks/useAIResearcherMessagePrompt';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSubmitAIResearcherPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getAIResearcherMessagePrompt } = useAIResearcherMessagePrompt();
  const [model] = useAIModel();

  const submitPrompt = useCallback(
    async ({
      query,
      refCellValues,
    }: {
      query: string;
      refCellValues: string;
    }): Promise<{ result?: string; error?: string }> => {
      const quadraticContext = getQuadraticContext('AIResearcher');
      const aiResearcherMessagePrompt = getAIResearcherMessagePrompt({ query, refCellValues });

      const chatMessages: ChatMessage[] = [...quadraticContext, aiResearcherMessagePrompt];
      const { system, messages } = getMessagesForModel(model, chatMessages);

      const abortController = new AbortController();
      const response = await handleAIRequestToAPI({
        model,
        system,
        messages,
        signal: abortController.signal,
        useStream: false,
        useTools: true,
        toolChoice: AITool.SetAIResearcherValue,
      });

      const setAIResearcherValueToolCall = response.toolCalls.find(
        (toolCall) => toolCall.name === AITool.SetAIResearcherValue
      );

      if (setAIResearcherValueToolCall) {
        try {
          const argsObject = JSON.parse(setAIResearcherValueToolCall.arguments);
          const output = aiToolsSpec[AITool.SetAIResearcherValue].responseSchema.parse(argsObject);
          return { result: output.cell_value };
        } catch (e) {
          console.error('[useAISetCodeCellValue] Error parsing set_ai_researcher_value response: ', e);
        }
      }

      return { error: 'No function call found' };
    },
    [handleAIRequestToAPI, getQuadraticContext, getAIResearcherMessagePrompt, model]
  );

  return { submitPrompt };
}
