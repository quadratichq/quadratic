import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useExaRequestToAPI } from '@/app/ai/hooks/useExaRequestToAPI';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getMessagesForModel } from '@/app/ai/tools/message.helper';
import { aiResearcherAbortControllerAtom, aiResearcherLoadingAtom } from '@/app/atoms/aiResearcherAtom';
import { exaSettingsAtom } from '@/app/atoms/exaSettingsAtom';
import { AIResearcherResult } from '@/app/ui/menus/AIResearcher/helpers/parseAIResearcherResult.helper';
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
      }): Promise<{
        result?: AIResearcherResult;
        error?: string;
      }> => {
        set(aiResearcherLoadingAtom, true);

        let abortController = await snapshot.getPromise(aiResearcherAbortControllerAtom);
        if (!abortController) {
          abortController = new AbortController();
          set(aiResearcherAbortControllerAtom, abortController);
        }

        const {
          type,
          numResults,
          livecrawl,
          useAutoprompt,
          text,
          highlights,
          summary,
          categories,
          includeText,
          excludeText,
          includeDomains,
          excludeDomains,
          startPublishedDate,
          endPublishedDate,
        } = await snapshot.getPromise(exaSettingsAtom);
        const exaResponse = await handleExaRequestToAPI({
          signal: abortController.signal,
          query: `Search this query: '${query}', for these cell value(s): '${refCellValues}'`,
          type,
          numResults,
          livecrawl,
          useAutoprompt,
          text,
          highlights,
          summary,
          categories,
          includeText: includeText.map((text) => text.trim()).filter((text) => text !== ''),
          excludeText: excludeText.map((text) => text.trim()).filter((text) => text !== ''),
          includeDomains: includeDomains.map((domain) => domain.trim()).filter((domain) => domain !== ''),
          excludeDomains: excludeDomains.map((domain) => domain.trim()).filter((domain) => domain !== ''),
          startPublishedDate,
          endPublishedDate,
        });

        const quadraticContext = getQuadraticContext('AIResearcher');
        const aiResearcherMessagePrompt = getAIResearcherMessagePrompt({
          query,
          refCellValues,
          exaResult: exaResponse.content?.results,
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
          toolChoice: AITool.SetAIResearcherResult,
        });

        const setAIResearcherValueToolCall = response.toolCalls.find(
          (toolCall) => toolCall.name === AITool.SetAIResearcherResult
        );

        let result: { result?: AIResearcherResult; error?: string } = { result: undefined, error: undefined };
        if (setAIResearcherValueToolCall) {
          try {
            const argsObject = JSON.parse(setAIResearcherValueToolCall.arguments);
            const output = aiToolsSpec[AITool.SetAIResearcherResult].responseSchema.parse(argsObject);
            result = { result: { exaResult: exaResponse.content?.results, toolCallArgs: output } };
          } catch (e) {
            console.error('[useAISetCodeCellValue] Error parsing set_ai_researcher_result response: ', e);
            result = { error: 'Error parsing set_ai_researcher_result response' };
          }
        } else {
          result = { error: 'API Error' };
        }

        set(aiResearcherAbortControllerAtom, undefined);
        set(aiResearcherLoadingAtom, false);

        return result;
      },
    [handleExaRequestToAPI, handleAIRequestToAPI, getQuadraticContext, getAIResearcherMessagePrompt, model]
  );

  return { submitPrompt };
}
