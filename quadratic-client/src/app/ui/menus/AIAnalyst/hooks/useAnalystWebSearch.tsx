import { aiAnalystWebSearchAtom } from '@/app/atoms/aiAnalystAtom';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { InternalMessage, ToolResultContent, WebSearchResult } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SearchArgs = z.infer<(typeof aiToolsSpec)[AITool.WebSearch]['responseSchema']>;

interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export const useAnalystWebSearch = () => {
  const search = useRecoilCallback(
    ({ set }) =>
      async ({
        searchArgs,
      }: {
        searchArgs: SearchArgs;
      }): Promise<{
        toolResultContent: ToolResultContent;
        internal?: InternalMessage;
      }> => {
        const { query } = searchArgs;

        const abortController = new AbortController();
        set(aiAnalystWebSearchAtom, { abortController, loading: true });

        let toolResultContent: ToolResultContent = [];
        let internal: InternalMessage | undefined = undefined;

        try {
          const response = await apiClient.ai.search(query, abortController.signal);
          const data = response as WebSearchResponse;

          if (abortController.signal.aborted) {
            toolResultContent = [createTextContent('Request aborted by the user.')];
          } else {
            // Format results as text for the AI to use
            const resultsText = data.results
              .map((result, i) => `[${i + 1}] ${result.title}\nURL: ${result.url}\n${result.excerpt}`)
              .join('\n\n---\n\n');

            toolResultContent = [
              createTextContent(
                resultsText || 'No search results found. Try rephrasing your query or searching for something else.'
              ),
            ];

            internal = {
              role: 'internal',
              contextType: 'webSearchInternal',
              content: {
                source: 'web_search',
                query,
                results: data.results,
              },
            };
          }
        } catch (error) {
          if (abortController.signal.aborted) {
            toolResultContent = [createTextContent('Request aborted by the user.')];
          } else {
            toolResultContent = [createTextContent('Failed to search the web. Please try again.')];
          }
        }

        set(aiAnalystWebSearchAtom, { abortController: undefined, loading: false });

        return { toolResultContent, internal };
      },
    []
  );

  return { search };
};
