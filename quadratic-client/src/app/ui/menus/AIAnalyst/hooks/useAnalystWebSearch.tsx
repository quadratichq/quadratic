import { aiStore, webSearchAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import {
  createTextContent,
  isContentGoogleSearchGroundingMetadata,
  isContentText,
} from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_SEARCH_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, InternalMessage, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';
import type { z } from 'zod';

type SearchArgs = z.infer<(typeof aiToolsSpec)[AITool.WebSearch]['responseSchema']>;

export const useAnalystWebSearch = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const search = useCallback(
    async ({
      searchArgs,
    }: {
      searchArgs: SearchArgs;
    }): Promise<{
      toolResultContent: ToolResultContent;
      internal?: InternalMessage;
    }> => {
      const { query } = searchArgs;

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [createTextContent(`Use the google_search tool and search the web for: ${query}`)],
          contextType: 'userPrompt',
        },
      ];

      const abortController = new AbortController();
      aiStore.set(webSearchAtom, { abortController, loading: true });

      const chatId = v4();
      const response = await handleAIRequestToAPI({
        chatId,
        source: 'WebSearch',
        messageSource: 'WebSearch',
        modelKey: DEFAULT_SEARCH_MODEL,
        messages,
        useStream: false,
        toolName: AITool.WebSearchInternal,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
        signal: abortController.signal,
      });

      let toolResultContent: ToolResultContent = [];
      let internal: InternalMessage | undefined = undefined;

      if (abortController.signal.aborted) {
        toolResultContent = [createTextContent('Request aborted by the user.')];
      } else {
        toolResultContent = response.content.filter((content) => isContentText(content));
        internal = {
          role: 'internal',
          contextType: 'webSearchInternal',
          content: {
            source: 'google_search',
            query,
            results: response.content.filter(
              (content) => isContentText(content) || isContentGoogleSearchGroundingMetadata(content)
            ),
          },
        };
      }

      aiStore.set(webSearchAtom, { abortController: undefined, loading: false });

      return { toolResultContent, internal };
    },
    [handleAIRequestToAPI]
  );

  return { search };
};
