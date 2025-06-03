import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { aiAnalystWebSearchAtom } from '@/app/atoms/aiAnalystAtom';
import { DEFAULT_SEARCH_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

type SearchArgs = z.infer<(typeof aiToolsSpec)[AITool.WebSearch]['responseSchema']>;

export const useAnalystWebSearch = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const search = useRecoilCallback(
    ({ set }) =>
      async ({ searchArgs }: { searchArgs: SearchArgs }): Promise<ToolResultContent> => {
        const { query } = searchArgs;

        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Use the google_search tool and earch the web for: ${query}`,
              },
            ],
            contextType: 'userPrompt',
          },
        ];

        const abortController = new AbortController();
        set(aiAnalystWebSearchAtom, { abortController, loading: true });

        const chatId = v4();
        const response = await handleAIRequestToAPI({
          chatId,
          source: 'WebSearch',
          modelKey: DEFAULT_SEARCH_MODEL,
          messages,
          useStream: false,
          toolName: AITool.WebSearchInternal,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: false,
          signal: abortController.signal,
        });

        console.log('WebSearch', response);

        if (abortController.signal.aborted) {
          return [{ type: 'text', text: 'Request aborted by the user.' }];
        }

        set(aiAnalystWebSearchAtom, { abortController: undefined, loading: false });

        // we get back text and metadata in the response, just send the text
        return [
          {
            type: 'text',
            text: response.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n'),
          },
        ];
      },
    [handleAIRequestToAPI]
  );

  return { search };
};
