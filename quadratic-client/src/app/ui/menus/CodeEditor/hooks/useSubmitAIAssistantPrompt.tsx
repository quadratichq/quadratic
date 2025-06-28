import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
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
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { isSameCodeCell, type CodeCell } from '@/app/shared/types/codeCell';
import mixpanel from 'mixpanel-browser';
import {
  getLastAIPromptMessageIndex,
  getPromptMessagesForAI,
  isContentFile,
  removeOldFilesInToolResult,
} from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIMessage, ChatMessage, Content, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAssistantPromptArgs = {
  content: Content;
  messageIndex: number;
  codeCell?: CodeCell;
};

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const { modelKey } = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ snapshot }) =>
      async ({ codeCell }: { codeCell: CodeCell }): Promise<ChatMessage[]> => {
        const [currentSheetContext, visibleContext, codeContext, prevMessages] = await Promise.all([
          getCurrentSheetContext({ currentSheetName: sheets.sheet.name }),
          getVisibleContext(),
          getCodeCellContext({ codeCell }),
          snapshot.getPromise(aiAssistantMessagesAtom),
        ]);

        const messagesWithContext: ChatMessage[] = [
          ...currentSheetContext,
          ...visibleContext,
          ...codeContext,
          ...getPromptMessagesForAI(prevMessages),
        ];

        return messagesWithContext;
      },
    [getCurrentSheetContext, getVisibleContext, getCodeCellContext]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ content, messageIndex, codeCell }: SubmitAIAssistantPromptArgs) => {
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
              currentContent.text += '\n\nRequest aborted by the user.';
              currentContent.text = currentContent.text.trim();
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
        set(aiAssistantIdAtom, (prev) => {
          chatId = prev ? prev : v4();
          return chatId;
        });

        try {
          // Handle tool calls
          let toolCallIterations = 0;
          while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
            // Send tool call results to API
            const messagesWithContext = await updateInternalContext({ codeCell });
            lastMessageIndex = getLastAIPromptMessageIndex(messagesWithContext);
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAssistant',
              modelKey,
              time: new Date().toString(),
              messages: messagesWithContext,
              useStream: true,
              toolName: undefined,
              useToolsPrompt: true,
              language: getLanguage(codeCell.language),
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAssistantMessagesAtom, updater),
              signal: abortController.signal,
              onExceededBillingLimit,
            });

            if (response.toolCalls.length === 0) {
              break;
            }

            toolCallIterations++;

            // Message containing tool call results
            const toolResultMessage: ToolResultMessage = {
              role: 'user',
              content: [],
              contextType: 'toolResult',
            };

            for (const toolCall of response.toolCalls) {
              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                const aiTool = toolCall.name as AITool;
                const argsObject = JSON.parse(toolCall.arguments);
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

            set(aiAssistantMessagesAtom, (prev) => [
              ...removeOldFilesInToolResult(prev, filesInToolResult),
              toolResultMessage,
            ]);
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
              currentContent.text += '\n\nLooks like there was a problem. Please try again.';
              currentContent.text = currentContent.text.trim();
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
