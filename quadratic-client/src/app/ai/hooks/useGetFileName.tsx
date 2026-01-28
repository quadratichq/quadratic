import { aiStore, currentChatMessagesAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { toMarkdown } from '@/app/ai/utils/markdownFormatter';
import { aiAssistantMessagesAtom } from '@/app/atoms/codeEditorAtom';
import { createTextContent, getPromptMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_CHAT_NAME_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export const useGetFileName = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();

  const getFileName = useRecoilCallback(
    ({ snapshot }) =>
      async (): Promise<string> => {
        // Get messages from both AIAssistant and AIAnalyst
        const [aiAssistantMessages, aiAnalystMessages] = await Promise.all([
          snapshot.getPromise(aiAssistantMessagesAtom),
          Promise.resolve(aiStore.get(currentChatMessagesAtom)),
        ]);

        // Combine and filter messages to get only user prompts and assistant responses
        const allMessages: ChatMessage[] = [...aiAssistantMessages, ...aiAnalystMessages];

        // Sort by timestamp if available, otherwise maintain order
        // For now, we'll use the order they appear in the arrays
        const chatPromptMessages = getPromptMessagesForAI(allMessages).map((message) => ({
          role: message.role,
          content: message.content.filter((content) => 'type' in content && content.type === 'text'),
        }));

        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              createTextContent(
                `Use set_file_name tool to set the name for this file based on the following chat messages between AI assistant and the user.\n
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
        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'GetFileName',
          messageSource: 'GetFileName',
          modelKey: DEFAULT_GET_CHAT_NAME_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          toolName: AITool.SetFileName,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: false,
        });

        const setFileNameToolCall = response.toolCalls.find((toolCall) => toolCall.name === AITool.SetFileName);
        if (setFileNameToolCall) {
          try {
            const argsObject = JSON.parse(setFileNameToolCall.arguments);
            const args = aiToolsSpec[AITool.SetFileName].responseSchema.parse(argsObject);
            return args.file_name;
          } catch (error) {
            console.error('[useGetFileName] toolCall: ', error);
          }
        }

        return '';
      },
    [handleAIRequestToAPI]
  );

  return { getFileName };
};
