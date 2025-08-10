import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
// import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useFilesContextMessages } from '@/app/ai/hooks/useFilesContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { aiAnalystCurrentChatAtom } from '@/app/atoms/aiAnalystAtom';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantCurrentChatMessagesCountAtom,
  aiAssistantIdAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantWaitingOnMessageIndexAtom,
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorWaitingForEditorClose,
  showAIAssistantAtom,
} from '@/app/atoms/codeEditorAtom';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { isSameCodeCell, type CodeCell } from '@/app/shared/types/codeCell';
import mixpanel from 'mixpanel-browser';
import {
  getLastAIPromptMessageIndex,
  getMessagesForAI,
  getPromptAndInternalMessages,
  isContentFile,
  removeOldFilesInToolResult,
} from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIMessage, ChatMessage, Content, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAssistantPromptArgs = {
  messageSource: string;
  content: Content;
  messageIndex: number;
  codeCell?: CodeCell;
};

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  // const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getFilesContext } = useFilesContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const { modelKey } = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ snapshot }) =>
      async ({
        codeCell,
        chatMessages,
      }: {
        codeCell: CodeCell;
        chatMessages: ChatMessage[];
      }): Promise<ChatMessage[]> => {
        const [filesContext, /*currentSheetContext,*/ visibleContext, codeContext, prevMessages] = await Promise.all([
          getFilesContext({ chatMessages }),
          // getCurrentSheetContext({ currentSheetName: sheets.sheet.name }),
          getVisibleContext(),
          getCodeCellContext({ codeCell }),
          snapshot.getPromise(aiAssistantMessagesAtom),
        ]);

        const messagesWithContext: ChatMessage[] = [
          ...filesContext,
          // ...currentSheetContext,
          ...visibleContext,
          ...codeContext,
          ...getPromptAndInternalMessages(prevMessages),
        ];

        return messagesWithContext;
      },
    [/*getCurrentSheetContext, */ getVisibleContext, getCodeCellContext]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ messageSource, content, messageIndex, codeCell }: SubmitAIAssistantPromptArgs) => {
        set(showAIAssistantAtom, true);

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;

        // fork chat, if we are editing an existing chat
        const currentMessageCount = await snapshot.getPromise(aiAssistantCurrentChatMessagesCountAtom);
        if (messageIndex < currentMessageCount) {
          set(aiAssistantIdAtom, v4());
          set(aiAssistantMessagesAtom, (prev) => prev.slice(0, messageIndex));
        }

        const onExceededBillingLimit = (exceededBillingLimit: boolean) => {
          if (!exceededBillingLimit) {
            return;
          }

          set(aiAssistantMessagesAtom, (prev) => {
            const currentMessage = [...prev];
            currentMessage.pop();
            messageIndex = currentMessage.length - 1;
            return currentMessage;
          });

          set(aiAssistantWaitingOnMessageIndexAtom, messageIndex);

          mixpanel.track('[Billing].ai.exceededBillingLimit', {
            exceededBillingLimit: exceededBillingLimit,
            location: 'AIAssistant',
          });
        };

        set(codeEditorDiffEditorContentAtom, undefined);
        const currentCodeCellInEditor = await snapshot.getPromise(codeEditorCodeCellAtom);
        if (codeCell && !isSameCodeCell(codeCell, currentCodeCellInEditor)) {
          set(codeEditorWaitingForEditorClose, {
            codeCell,
            showCellTypeMenu: false,
            initialCode: '',
            inlineEditor: false,
          });
        } else if (!codeCell) {
          codeCell = currentCodeCellInEditor;
        }

        set(aiAssistantMessagesAtom, (prevMessages) => [
          ...prevMessages,
          {
            role: 'user' as const,
            content,
            contextType: 'userPrompt' as const,
          },
        ]);

        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
          let prevWaitingOnMessageIndex: number | undefined = undefined;
          set(aiAssistantWaitingOnMessageIndexAtom, (prev) => {
            prevWaitingOnMessageIndex = prev;
            return undefined;
          });

          set(aiAssistantMessagesAtom, (prevMessages) => {
            const lastMessage = prevMessages.at(-1);
            if (lastMessage?.role === 'assistant' && lastMessage?.contextType === 'userPrompt') {
              const newLastMessage = { ...lastMessage };
              let currentContent = { ...(newLastMessage.content.at(-1) ?? { type: 'text', text: '' }) };
              if (currentContent?.type !== 'text') {
                currentContent = { type: 'text', text: '' };
              }
              currentContent.text = currentContent.text.trim();
              currentContent.text += '\n\nRequest aborted by the user.';
              newLastMessage.toolCalls = [];
              newLastMessage.content = [...newLastMessage.content.slice(0, -1), currentContent];
              return [...prevMessages.slice(0, -1), newLastMessage];
            } else if (lastMessage?.role === 'user') {
              if (prevWaitingOnMessageIndex !== undefined) {
                return prevMessages;
              }

              const newLastMessage: AIMessage = {
                role: 'assistant',
                content: [{ type: 'text', text: 'Request aborted by the user.' }],
                contextType: 'userPrompt',
                toolCalls: [],
                modelKey,
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });
        });
        set(aiAssistantAbortControllerAtom, abortController);

        set(aiAssistantLoadingAtom, true);

        let lastMessageIndex = -1;
        let chatId = '';
        let chatMessages: ChatMessage[] = [];
        set(aiAnalystCurrentChatAtom, (prev) => {
          chatId = prev.id ? prev.id : v4();
          chatMessages = prev.messages;
          return {
            ...prev,
            id: chatId,
            lastUpdated: Date.now(),
          };
        });

        try {
          // Handle tool calls
          let toolCallIterations = 0;
          while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
            toolCallIterations++;

            // Update internal context
            chatMessages = await updateInternalContext({ codeCell, chatMessages });
            set(aiAssistantMessagesAtom, chatMessages);

            const messagesForAI = getMessagesForAI(chatMessages);
            lastMessageIndex = getLastAIPromptMessageIndex(messagesForAI);

            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAssistant',
              messageSource,
              modelKey,
              messages: messagesForAI,
              useStream: true,
              toolName: undefined,
              useToolsPrompt: true,
              language: getLanguage(codeCell.language),
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAssistantMessagesAtom, updater),
              signal: abortController.signal,
              onExceededBillingLimit,
            });

            const waitingOnMessageIndex = await snapshot.getPromise(aiAssistantWaitingOnMessageIndexAtom);
            if (waitingOnMessageIndex !== undefined) {
              break;
            }

            if (response.error) {
              break;
            }

            if (response.toolCalls.length === 0) {
              break;
            }

            messageSource = response.toolCalls.map((toolCall) => toolCall.name).join(', ');

            // Message containing tool call results
            const toolResultMessage: ToolResultMessage = {
              role: 'user',
              content: [],
              contextType: 'toolResult',
            };

            for (const toolCall of response.toolCalls) {
              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                try {
                  inlineEditorHandler.close({ skipFocusGrid: true });
                  const aiTool = toolCall.name as AITool;
                  const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
                  const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                  const toolResultContent = await aiToolsActions[aiTool](args as any, {
                    source: 'AIAssistant',
                    chatId,
                    messageIndex: lastMessageIndex + 1,
                  });
                  toolResultMessage.content.push({
                    id: toolCall.id,
                    content: toolResultContent,
                  });
                } catch (error) {
                  toolResultMessage.content.push({
                    id: toolCall.id,
                    content: [
                      {
                        type: 'text',
                        text: `Error parsing ${toolCall.name} tool's arguments: ${error}`,
                      },
                    ],
                  });
                }
              } else {
                toolResultMessage.content.push({
                  id: toolCall.id,
                  content: [
                    {
                      type: 'text',
                      text: 'Unknown tool',
                    },
                  ],
                });
              }
            }

            const filesInToolResult = toolResultMessage.content.reduce((acc, result) => {
              result.content.forEach((content) => {
                if (isContentFile(content)) {
                  acc.add(content.fileName);
                }
              });
              return acc;
            }, new Set<string>());

            let nextChatMessages: ChatMessage[] = [];
            set(aiAssistantMessagesAtom, (prev) => {
              nextChatMessages = [...removeOldFilesInToolResult(prev, filesInToolResult), toolResultMessage];
              return nextChatMessages;
            });
            chatMessages = nextChatMessages;
          }
        } catch (error) {
          set(aiAssistantMessagesAtom, (prevMessages) => {
            const lastMessage = prevMessages.at(-1);
            if (lastMessage?.role === 'assistant' && lastMessage?.contextType === 'userPrompt') {
              const newLastMessage = { ...lastMessage };
              let currentContent = { ...(newLastMessage.content.at(-1) ?? { type: 'text', text: '' }) };
              if (currentContent?.type !== 'text') {
                currentContent = { type: 'text', text: '' };
              }
              currentContent.text = currentContent.text.trim();
              currentContent.text += '\n\nLooks like there was a problem. Please try again.';
              newLastMessage.toolCalls = [];
              newLastMessage.content = [...newLastMessage.content.slice(0, -1), currentContent];
              return [...prevMessages.slice(0, -1), newLastMessage];
            } else if (lastMessage?.role === 'user') {
              const newLastMessage: AIMessage = {
                role: 'assistant',
                content: [{ type: 'text', text: 'Looks like there was a problem. Please try again.' }],
                contextType: 'userPrompt',
                toolCalls: [],
                modelKey,
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });

          console.error(error);
        }

        set(aiAssistantAbortControllerAtom, undefined);
        set(aiAssistantLoadingAtom, false);
      },
    [handleAIRequestToAPI, updateInternalContext, modelKey]
  );

  return { submitPrompt };
}
