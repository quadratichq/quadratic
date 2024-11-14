import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useExaRequestToAPI } from '@/app/ai/hooks/useExaRequestToAPI';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getMessagesForModel } from '@/app/ai/tools/message.helper';
import { aiResearcherAbortControllerAtom, aiResearcherLoadingAtom } from '@/app/atoms/aiResearcherAtom';
import { exaSettingsAtom } from '@/app/atoms/exaSettingsAtom';
import { useAIResearcherMessagePrompt } from '@/app/ui/menus/AIResearcher/hooks/useAIResearcherMessagePrompt';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIResearcherPrompt() {
  const { handleExaRequestToAPI } = useExaRequestToAPI();
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getAIResearcherMessagePrompt } = useAIResearcherMessagePrompt();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ snapshot, set }) =>
      async ({
        query,
        refCellValues,
      }: {
        query: string;
        refCellValues: string;
      }): Promise<{ result?: string; error?: string }> => {
        set(aiResearcherLoadingAtom, true);

        let abortController = await snapshot.getPromise(aiResearcherAbortControllerAtom);
        if (!abortController) {
          abortController = new AbortController();
          set(aiResearcherAbortControllerAtom, abortController);
        }

        const exaSettings = await snapshot.getPromise(exaSettingsAtom);
        const exaResponse = await handleExaRequestToAPI({
          signal: abortController.signal,
          query: `Search this query: '${query}', for these cell value(s): '${refCellValues}'`,
          ...exaSettings,
        });
        const exaResult = exaResponse.error ? undefined : exaResponse.content;

        // TODO(ayush): remove this before merging
        console.log('Exa result:\n', exaResult);

        const quadraticContext = getQuadraticContext('AIResearcher');
        const aiResearcherMessagePrompt = getAIResearcherMessagePrompt({
          query,
          refCellValues,
          exaResult,
        });

        const chatMessages: ChatMessage[] = [...quadraticContext, aiResearcherMessagePrompt];
        const { system, messages } = getMessagesForModel(model, chatMessages);

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

        let result: { result?: string; error?: string } = { result: undefined, error: undefined };
        if (setAIResearcherValueToolCall) {
          try {
            const argsObject = JSON.parse(setAIResearcherValueToolCall.arguments);
            const output = aiToolsSpec[AITool.SetAIResearcherValue].responseSchema.parse(argsObject);

            // TODO(ayush): remove this before merging
            console.log(`${model} result:\n`, output);

            result = { result: output.cell_value };
          } catch (e) {
            console.error('[useAISetCodeCellValue] Error parsing set_ai_researcher_value response: ', e);
            result = { error: 'Error parsing set_ai_researcher_value response' };
          }
        } else {
          result = { error: 'No function call found' };
        }

        set(aiResearcherAbortControllerAtom, undefined);
        set(aiResearcherLoadingAtom, false);

        return result;
      },
    [handleExaRequestToAPI, handleAIRequestToAPI, getQuadraticContext, getAIResearcherMessagePrompt, model]
  );

  return { submitPrompt };
}
