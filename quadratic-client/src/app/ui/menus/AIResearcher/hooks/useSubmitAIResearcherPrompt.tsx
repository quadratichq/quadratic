import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useExaRequestToAPI } from '@/app/ai/hooks/useExaRequestToAPI';
import { aiResearcherAbortControllerAtom, aiResearcherLoadingAtom } from '@/app/atoms/aiResearcherAtom';
import { exaSettingsAtom } from '@/app/atoms/exaSettingsAtom';
import type { JsCellValuePos, SheetPos } from '@/app/quadratic-core-types';
import type { AIResearcherResultType } from '@/app/ui/menus/AIResearcher/helpers/parseAIResearcherResult.helper';
import { useAIResearcherMessagePrompt } from '@/app/ui/menus/AIResearcher/hooks/useAIResearcherMessagePrompt';
import { DEFAULT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export function useSubmitAIResearcherPrompt() {
  const { handleExaRequestToAPI } = useExaRequestToAPI();
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getAIResearcherMessagePrompt } = useAIResearcherMessagePrompt();

  const submitPrompt = useRecoilCallback(
    ({ snapshot, set }) =>
      async ({
        query,
        refCellValues,
        sheetPos,
        cellsAccessedValues,
      }: {
        query: string;
        refCellValues: string;
        sheetPos: SheetPos;
        cellsAccessedValues: JsCellValuePos[][][];
      }): Promise<{
        result?: AIResearcherResultType;
        error?: string;
      }> => {
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
          type: exaSettings.type,
          numResults: exaSettings.numResults,
          livecrawl: exaSettings.livecrawl,
          useAutoprompt: exaSettings.useAutoprompt,
          text: exaSettings.text,
          highlights: exaSettings.highlights,
          summary: exaSettings.summary,
          categories: exaSettings.categories,
          includeText: exaSettings.includeText.map((text) => text.trim()).filter((text) => text !== ''),
          excludeText: exaSettings.excludeText.map((text) => text.trim()).filter((text) => text !== ''),
          includeDomains: exaSettings.includeDomains.map((domain) => domain.trim()).filter((domain) => domain !== ''),
          excludeDomains: exaSettings.excludeDomains.map((domain) => domain.trim()).filter((domain) => domain !== ''),
          startPublishedDate: exaSettings.startPublishedDate,
          endPublishedDate: exaSettings.endPublishedDate,
        });

        const aiResearcherMessagePrompt = getAIResearcherMessagePrompt({
          query,
          refCellValues,
          sheetPos,
          cellsAccessedValues,
          exaResults: exaResponse.content?.results,
        });

        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'AIResearcher',
          model: DEFAULT_MODEL,
          messages: [aiResearcherMessagePrompt],
          useStream: false,
          useTools: true,
          toolName: AITool.SetAIResearcherResult,
          language: 'AIResearcher',
          useQuadraticContext: true,
          signal: abortController.signal,
        });

        const setAIResearcherValueToolCall = response.toolCalls.find(
          (toolCall) => toolCall.name === AITool.SetAIResearcherResult
        );

        let result: { result?: AIResearcherResultType; error?: string } = { result: undefined, error: undefined };
        if (setAIResearcherValueToolCall) {
          try {
            const argsObject = JSON.parse(setAIResearcherValueToolCall.arguments);
            const output = aiToolsSpec[AITool.SetAIResearcherResult].responseSchema.parse(argsObject);
            result = {
              result: {
                exaResults: exaResponse.content?.results,
                autopromptString: exaResponse.content?.autopromptString ?? undefined,
                toolCallArgs: output,
              },
            };
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
    [handleExaRequestToAPI, handleAIRequestToAPI, getAIResearcherMessagePrompt]
  );

  return { submitPrompt };
}
