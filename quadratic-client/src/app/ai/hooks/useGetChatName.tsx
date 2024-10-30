import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getMessagesForModel, getPromptMessages } from '@/app/ai/tools/helpers';
import { aiAnalystCurrentChatMessagesAtom } from '@/app/atoms/aiAnalystAtom';
import { AIPromptMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export const useGetChatName = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const [model] = useAIModel();

  const getChatName = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const chatMessages = await snapshot.getPromise(aiAnalystCurrentChatMessagesAtom);
        const chatPromptMessages = getPromptMessages(chatMessages);
        const { system, messages: prevMessages } = getMessagesForModel(model, chatPromptMessages);
        const messages: AIPromptMessage[] = [
          {
            role: 'user',
            content: `Use SetChatName tool to set the name for this chat based on the following chat messages between AI assistant and the user.\n
  Previous messages:\n
  \`\`\`json
  ${JSON.stringify(prevMessages)}
  \`\`\`
  `,
          },
        ];

        const abortController = new AbortController();
        const response = await handleAIRequestToAPI({
          model,
          system,
          messages,
          signal: abortController.signal,
          useStream: false,
          useTools: true,
          toolChoice: AITool.SetChatName,
        });

        const setChatNameToolCall = response.toolCalls.find((toolCall) => toolCall.name === AITool.SetChatName);
        if (setChatNameToolCall) {
          try {
            const argsObject = JSON.parse(setChatNameToolCall.arguments);
            const args = aiToolsSpec[AITool.SetChatName].responseSchema.parse(argsObject);
            return args.name;
          } catch (error) {
            console.error('[useGetChatName] toolCall: ', error);
          }
        }

        return '';
      },
    [handleAIRequestToAPI, model]
  );

  return { getChatName };
};
