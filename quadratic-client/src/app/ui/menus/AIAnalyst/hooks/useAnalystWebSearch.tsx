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

export type WebSearchSource = {
  title: string;
  uri: string;
};

export const useAnalystWebSearch = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const search = useRecoilCallback(
    ({ set }) =>
      async ({
        searchArgs,
      }: {
        searchArgs: SearchArgs;
      }): Promise<{
        toolResultContent: ToolResultContent;
        sources: WebSearchSource[];
      }> => {
        const { query } = searchArgs;

        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Use the google_search tool and search the web for: ${query}`,
              },
            ],
            contextType: 'userPrompt',
          },
        ];

        const abortController = new AbortController();
        set(aiAnalystWebSearchAtom, { abortController, loading: true, sources: [] });

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

        if (abortController.signal.aborted) {
          return {
            toolResultContent: [{ type: 'text', text: 'Request aborted by the user.' }],
            sources: [],
          };
        }

        set(aiAnalystWebSearchAtom, { abortController: undefined, loading: false, sources: [] });

        const toolResultContent = [
          {
            type: 'text' as const,
            text: response.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n'),
          },
        ];

        const sources = response.content
          .filter((c) => c.type === 'google_search_grounding_metadata')
          .reduce<WebSearchSource[]>((acc, c) => {
            try {
              const json = JSON.parse(c.text);
              return acc.concat(
                json.groundingChunks.map((chunk: any) => ({
                  title: chunk.web.title,
                  uri: chunk.web.uri,
                }))
              );
            } catch (e) {
              console.error('Error parsing JSON', e);
              return acc;
            }
          }, []);

        // we get back text and metadata in the response, just send the text
        return { toolResultContent, sources };
      },
    [handleAIRequestToAPI]
  );

  return { search };
};
