import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { aiAnalystCurrentChatMessagesAtom } from '@/app/atoms/aiAnalystAtom';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_CHAT_NAME_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export const useGetChatName = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const getChatName = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const chatMessages = await snapshot.getPromise(aiAnalystCurrentChatMessagesAtom);
        const chatPromptMessages = getPromptMessages(chatMessages);
        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: `Use set_chat_name tool to set the name for this chat based on the following chat messages between AI assistant and the user.\n
Previous messages:\n
\`\`\`json
${JSON.stringify(chatPromptMessages)}
\`\`\`
`,
            contextType: 'userPrompt',
          },
        ];

        const abortController = new AbortController();
        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'GetChatName',
          model: DEFAULT_GET_CHAT_NAME_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          useTools: true,
          toolName: AITool.SetChatName,
        });

        const setChatNameToolCall = response.toolCalls.find((toolCall) => toolCall.name === AITool.SetChatName);
        if (setChatNameToolCall) {
          try {
            const argsObject = JSON.parse(setChatNameToolCall.arguments);
            const args = aiToolsSpec[AITool.SetChatName].responseSchema.parse(argsObject);
            return args.chat_name;
          } catch (error) {
            console.error('[useGetChatName] toolCall: ', error);
          }
        }

        return '';
      },
    [handleAIRequestToAPI]
  );

  return { getChatName };
};
