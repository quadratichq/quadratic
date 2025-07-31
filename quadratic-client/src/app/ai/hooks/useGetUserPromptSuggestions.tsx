import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { aiAnalystCurrentChatMessagesAtom, aiAnalystPromptSuggestionsAtom } from '@/app/atoms/aiAnalystAtom';
import { getPromptMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_USER_PROMPT_SUGGESTIONS_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec, type AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';
import { toXml } from '../utils/xmlFormatter';

export const useGetUserPromptSuggestions = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const getUserPromptSuggestions = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const chatMessages = await snapshot.getPromise(aiAnalystCurrentChatMessagesAtom);
        const chatPromptMessages = getPromptMessagesForAI(chatMessages);
        if (!chatPromptMessages.length) {
          return [];
        }

        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `
Use user_prompt_suggestions tool to provide follow up prompts for the user based on the following chat messages between AI assistant and the user.\n
Previous messages:\n
\`\`\`text
${toXml(chatPromptMessages, 'chat_messages')}
\`\`\`
`,
              },
            ],
            contextType: 'userPrompt',
          },
        ];

        const abortController = new AbortController();
        set(aiAnalystPromptSuggestionsAtom, (prev) => {
          prev.abortController?.abort();
          return {
            abortController,
            suggestions: [],
          };
        });

        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'GetUserPromptSuggestions',
          messageSource: 'GetUserPromptSuggestions',
          modelKey: DEFAULT_GET_USER_PROMPT_SUGGESTIONS_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          toolName: AITool.UserPromptSuggestions,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: true,
        });

        let suggestions: z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'] = [];

        const userPromptSuggestionsToolCall = response.toolCalls.find(
          (toolCall) => toolCall.name === AITool.UserPromptSuggestions
        );
        if (userPromptSuggestionsToolCall) {
          try {
            const argsObject = JSON.parse(userPromptSuggestionsToolCall.arguments);
            const args = aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject);
            suggestions = args.prompt_suggestions;
          } catch (error) {
            console.error('[useGetUserPromptSuggestions] toolCall: ', error);
          }
        }

        set(aiAnalystPromptSuggestionsAtom, {
          abortController: undefined,
          suggestions,
        });
      },
    [handleAIRequestToAPI]
  );

  return { getUserPromptSuggestions };
};
