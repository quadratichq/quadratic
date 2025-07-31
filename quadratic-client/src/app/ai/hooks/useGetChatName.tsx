import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { aiAnalystCurrentChatMessagesAtom } from '@/app/atoms/aiAnalystAtom';
import { getPromptMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_CHAT_NAME_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import { toXml } from '../utils/xmlFormatter';

export const useGetChatName = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const getChatName = useRecoilCallback(
    ({ snapshot }) =>
      async (): Promise<string> => {
        const chatMessages = await snapshot.getPromise(aiAnalystCurrentChatMessagesAtom);
        const chatPromptMessages = getPromptMessagesForAI(chatMessages).map((message) => ({
          role: message.role,
          content: message.content.filter((content) => 'type' in content && content.type === 'text'),
        }));
        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Use set_chat_name tool to set the name for this chat based on the following chat messages between AI assistant and the user.\n
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
        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'GetChatName',
          messageSource: 'GetChatName',
          modelKey: DEFAULT_GET_CHAT_NAME_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          toolName: AITool.SetChatName,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: false,
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
