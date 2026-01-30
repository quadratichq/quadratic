import { aiStore, currentChatMessagesAtom, promptSuggestionsAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { toMarkdown } from '@/app/ai/utils/markdownFormatter';
import { createTextContent, getPromptMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_USER_PROMPT_SUGGESTIONS_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';

export const useGetUserPromptSuggestions = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const getUserPromptSuggestions = useCallback(async () => {
    let suggestions: AIToolsArgs[AITool.UserPromptSuggestions]['prompt_suggestions'] = [];
    try {
      const chatMessages = aiStore.get(currentChatMessagesAtom);
      const chatPromptMessages = getPromptMessagesForAI(chatMessages);
      if (!chatPromptMessages.length) {
        return [];
      }

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            createTextContent(
              `Use user_prompt_suggestions tool to provide follow up prompts for the user based on the following chat messages between AI assistant and the user.\n
Previous messages:\n
\`\`\`
${toMarkdown(chatPromptMessages, 'chat_messages')}
\`\`\`
`
            ),
          ],
          contextType: 'userPrompt',
        },
      ];

      const abortController = new AbortController();
      const prev = aiStore.get(promptSuggestionsAtom);
      prev.abortController?.abort();
      aiStore.set(promptSuggestionsAtom, {
        abortController,
        suggestions: [],
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

      const userPromptSuggestionsToolCall = response.toolCalls.find(
        (toolCall) => toolCall.name === AITool.UserPromptSuggestions
      );
      if (userPromptSuggestionsToolCall) {
        const argsObject = JSON.parse(userPromptSuggestionsToolCall.arguments);
        const args = aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject);
        suggestions = args.prompt_suggestions;
      }
    } catch (error) {
      console.error('[useGetUserPromptSuggestions] error: ', error);
    }
    aiStore.set(promptSuggestionsAtom, {
      abortController: undefined,
      suggestions,
    });
  }, [handleAIRequestToAPI]);

  return { getUserPromptSuggestions };
};
