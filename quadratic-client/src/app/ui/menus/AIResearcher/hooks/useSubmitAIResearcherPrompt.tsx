import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import { useAIResearcherContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useAIResearcherContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useQuadraticContextMessages';
import { AI_TOOL_DEFINITIONS } from '@/app/ui/menus/AIAssistant/TOOLS';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSubmitAIResearcherPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getAIResearcherContext } = useAIResearcherContextMessages();
  const [model] = useAIAssistantModel();

  const submitPrompt = useCallback(
    async ({
      prompt,
      refCellValues,
    }: {
      prompt: string;
      refCellValues: string;
    }): Promise<{ result?: string; error?: string }> => {
      const quadraticContext = getQuadraticContext('AIResearcher', model);
      const aiResearcherContext = await getAIResearcherContext({ prompt, refCellValues });

      const contextMessages: (UserMessage | AIMessage)[] = [...quadraticContext, aiResearcherContext];
      const messagesToSend: PromptMessage[] = [
        ...contextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ];

      const abortController = new AbortController();
      const response = await handleAIRequestToAPI({
        model,
        messages: messagesToSend,
        signal: abortController.signal,
        useStream: false,
        useTools: true,
        toolChoice: 'set_ai_researcher_value',
      });

      const responseSchema = AI_TOOL_DEFINITIONS['set_ai_researcher_value'].responseSchema;

      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls.find(
          (functionCall) => functionCall.name === 'set_ai_researcher_value'
        );
        if (functionCall) {
          try {
            const argsObject = JSON.parse(functionCall.arguments);
            const output = responseSchema.parse(argsObject);
            return { result: output.cell_value };
          } catch (e) {
            console.error('[useAISetCodeCellValue] Error parsing set_ai_researcher_value response: ', e);
          }
        }
        return { error: 'No function call found' };
      }
      return { error: 'No function call found' };
    },
    [handleAIRequestToAPI, getQuadraticContext, getAIResearcherContext, model]
  );

  return { submitPrompt };
}
