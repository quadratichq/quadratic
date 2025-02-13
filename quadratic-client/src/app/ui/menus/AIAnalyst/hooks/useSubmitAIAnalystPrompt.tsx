import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useOtherSheetsContextMessages } from '@/app/ai/hooks/useOtherSheetsContextMessages';
import { useSelectionContextMessages } from '@/app/ai/hooks/useSelectionContextMessages';
import { useTablesContextMessages } from '@/app/ai/hooks/useTablesContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessage,
  AIMessagePrompt,
  ChatMessage,
  Context,
  ToolResultMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAnalystPromptArgs = {
  userPrompt: string;
  context: Context;
  messageIndex?: number;
  clearMessages?: boolean;
};

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getOtherSheetsContext } = useOtherSheetsContextMessages();
  const { getTablesContext } = useTablesContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const [model] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ set }) =>
      async ({ context }: { context: Context }): Promise<ChatMessage[]> => {
        const [otherSheetsContext, tablesContext, currentSheetContext, visibleContext, selectionContext] =
          await Promise.all([
            getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
            getTablesContext(),
            getCurrentSheetContext({ currentSheetName: context.currentSheet }),
            getVisibleContext(),
            getSelectionContext({ selection: context.selection }),
          ]);

        let updatedMessages: ChatMessage[] = [];
        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
          prevMessages = getPromptMessages(prevMessages);

          updatedMessages = [
            ...otherSheetsContext,
            ...tablesContext,
            ...currentSheetContext,
            ...visibleContext,
            ...selectionContext,
            ...prevMessages,
          ];

          return updatedMessages;
        });

        return updatedMessages;
      },
    [getOtherSheetsContext, getTablesContext, getCurrentSheetContext, getVisibleContext, getSelectionContext]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ userPrompt, context, messageIndex, clearMessages }: SubmitAIAnalystPromptArgs) => {
        set(showAIAnalystAtom, true);
        set(aiAnalystShowChatHistoryAtom, false);

        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
            const lastMessage = prevMessages.at(-1);
            if (lastMessage?.role === 'assistant' && lastMessage?.contextType === 'userPrompt') {
              const newLastMessage = { ...lastMessage };
              newLastMessage.content += '\n\nRequest aborted by the user.';
              newLastMessage.content = newLastMessage.content.trim();
              newLastMessage.toolCalls = [];
              return [...prevMessages.slice(0, -1), newLastMessage];
            } else if (lastMessage?.role === 'user') {
              const newLastMessage: AIMessage = {
                role: 'assistant',
                content: 'Request aborted by the user.',
                contextType: 'userPrompt',
                toolCalls: [],
                model,
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });
        });
        set(aiAnalystAbortControllerAtom, abortController);

        if (clearMessages) {
          set(aiAnalystCurrentChatAtom, {
            id: v4(),
            name: '',
            lastUpdated: Date.now(),
            messages: [],
          });
        }

        // fork chat, if we are editing an existing chat
        if (messageIndex !== undefined) {
          set(aiAnalystCurrentChatAtom, (prev) => {
            return {
              id: v4(),
              name: '',
              lastUpdated: Date.now(),
              messages: prev.messages.slice(0, messageIndex),
            };
          });
        }

        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => [
          ...prevMessages,
          {
            role: 'user' as const,
            content: userPrompt,
            contextType: 'userPrompt' as const,
            context: {
              ...context,
              selection: context.selection ?? sheets.sheet.cursor.save(),
            },
          },
        ]);

        let chatId = '';
        set(aiAnalystCurrentChatAtom, (prev) => {
          chatId = prev.id ? prev.id : v4();
          return {
            ...prev,
            id: chatId,
            lastUpdated: Date.now(),
          };
        });

        try {
          // Send user prompt to API
          const updatedMessages = await updateInternalContext({ context });
          const response = await handleAIRequestToAPI({
            chatId,
            source: 'AIAnalyst',
            model,
            messages: updatedMessages,
            useStream: true,
            useTools: true,
            useToolsPrompt: true,
            language: undefined,
            useQuadraticContext: true,
            setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
            signal: abortController.signal,
          });
          let toolCalls: AIMessagePrompt['toolCalls'] = response.toolCalls;

          // Handle tool calls
          let toolCallIterations = 0;
          while (toolCalls.length > 0 && toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
            toolCallIterations++;

            // Message containing tool call results
            const toolResultMessage: ToolResultMessage = {
              role: 'user',
              content: [],
              contextType: 'toolResult',
            };

            for (const toolCall of toolCalls) {
              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                const aiTool = toolCall.name as AITool;
                const argsObject = JSON.parse(toolCall.arguments);
                const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                const result = await aiToolsActions[aiTool](args as any);
                toolResultMessage.content.push({
                  id: toolCall.id,
                  content: result,
                });
              } else {
                toolResultMessage.content.push({
                  id: toolCall.id,
                  content: 'Unknown tool',
                });
              }
            }
            toolCalls = [];

            set(aiAnalystCurrentChatMessagesAtom, (prev) => [...prev, toolResultMessage]);

            // Send tool call results to API
            const updatedMessages = await updateInternalContext({ context });
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAnalyst',
              model,
              messages: updatedMessages,
              useStream: true,
              useTools: true,
              useToolsPrompt: true,
              language: undefined,
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
            });
            toolCalls = response.toolCalls;
          }
        } catch (error) {
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
            const lastMessage = prevMessages.at(-1);
            if (lastMessage?.role === 'assistant' && lastMessage?.contextType === 'userPrompt') {
              const newLastMessage = { ...lastMessage };
              newLastMessage.content += '\n\nLooks like there was a problem. Please try again.';
              newLastMessage.content = newLastMessage.content.trim();
              newLastMessage.toolCalls = [];
              return [...prevMessages.slice(0, -1), newLastMessage];
            } else if (lastMessage?.role === 'user') {
              const newLastMessage: AIMessage = {
                role: 'assistant',
                content: 'Looks like there was a problem. Please try again.',
                contextType: 'userPrompt',
                toolCalls: [],
                model,
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });

          console.error(error);
        }

        set(aiAnalystAbortControllerAtom, undefined);
        set(aiAnalystLoadingAtom, false);
      },
    [handleAIRequestToAPI, model]
  );

  return { submitPrompt };
}
