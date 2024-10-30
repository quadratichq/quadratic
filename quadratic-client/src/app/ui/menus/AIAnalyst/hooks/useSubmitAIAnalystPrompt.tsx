import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { useSelectionContextMessages } from '@/app/ai/hooks/useSelectionContextMessages';
import { useToolUseMessages } from '@/app/ai/hooks/useToolUseMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getMessagesForModel } from '@/app/ai/tools/helpers';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  defaultAIAnalystContext,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIMessage, AIMessagePrompt, ChatMessage, Context, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

const MAX_TOOL_CALL_ITERATIONS = 5;

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getToolUsePrompt } = useToolUseMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const [model] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ set }) =>
      async ({ context }: { context: Context }): Promise<ChatMessage[]> => {
        const quadraticContext = context.quadraticDocs ? getQuadraticContext({ model }) : [];
        const currentSheetContext = context.currentSheet ? await getCurrentSheetContext({ model }) : [];
        const visibleContext = context.visibleData ? await getVisibleContext({ model }) : [];
        const toolUsePrompt = context.toolUse ? getToolUsePrompt({ model }) : [];
        const selectionContext = (
          await Promise.all(
            context.selection.map((sheetRect) =>
              getSelectionContext({
                sheetRect,
                model,
              })
            )
          )
        ).flat();

        let updatedMessages: ChatMessage[] = [];
        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
          prevMessages = prevMessages.filter(
            (message) =>
              message.contextType !== 'quadraticDocs' &&
              message.contextType !== 'currentFile' &&
              message.contextType !== 'currentSheet' &&
              message.contextType !== 'connections' &&
              message.contextType !== 'visibleData' &&
              message.contextType !== 'toolUse'
          );

          updatedMessages = [
            ...quadraticContext,
            ...currentSheetContext,
            ...visibleContext,
            ...toolUsePrompt,
            ...selectionContext,
            ...prevMessages,
          ];

          return updatedMessages;
        });

        return updatedMessages;
      },
    [getQuadraticContext, getCurrentSheetContext, getVisibleContext, getToolUsePrompt, getSelectionContext, model]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        context = defaultAIAnalystContext,
        messageIndex,
        clearMessages,
        selectionSheetRect,
      }: {
        userPrompt: string;
        context?: Context;
        messageIndex?: number;
        clearMessages?: boolean;
        selectionSheetRect?: SheetRect;
      }) => {
        set(showAIAnalystAtom, true);
        set(aiAnalystShowChatHistoryAtom, false);

        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAnalystAbortControllerAtom, abortController);

        if (clearMessages) {
          set(aiAnalystCurrentChatAtom, {
            id: '',
            name: '',
            lastUpdated: Date.now(),
            messages: [],
          });
        }

        // fork chat, if we are editing an existing chat
        if (messageIndex !== undefined) {
          set(aiAnalystCurrentChatAtom, (prev) => {
            return {
              id: '',
              name: '',
              lastUpdated: Date.now(),
              messages: prev.messages.slice(0, messageIndex),
            };
          });
        }

        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => [
          ...prevMessages,
          { role: 'user' as const, content: userPrompt, contextType: 'userPrompt' as const, context },
        ]);

        if (selectionSheetRect) {
          context = { ...context, selection: [...context.selection, selectionSheetRect] };
        }

        try {
          // Send user prompt to API
          const updatedMessages = await updateInternalContext({ context });
          const response = await handleAIRequestToAPI({
            model,
            messages: getMessagesForModel(model, updatedMessages),
            setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
            signal: abortController.signal,
            useStream: true,
            useTools: true,
          });
          let toolCalls: AIMessagePrompt['toolCalls'] = response.toolCalls;

          let toolCallIterations = 0;

          // Handle tool calls
          while (toolCalls.length > 0 && toolCallIterations <= MAX_TOOL_CALL_ITERATIONS) {
            toolCallIterations++;

            // Message containing tool call results
            const toolResultMessage: UserMessage = {
              role: 'user',
              content: [],
              contextType: 'toolResult',
            };

            for (const toolCall of toolCalls) {
              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                const aiTool = toolCall.name as AITool;
                const argsObject = JSON.parse(toolCall.arguments);
                const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                const result = await aiToolsSpec[aiTool].action(args as any);
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
              model,
              messages: getMessagesForModel(model, updatedMessages),
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
              useStream: true,
              useTools: true,
            });
            toolCalls = response.toolCalls;
          }
        } catch (error) {
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
            const aiMessage: AIMessage = {
              role: 'assistant',
              content: 'Looks like there was a problem. Please try again.',
              contextType: 'userPrompt',
              model,
              toolCalls: [],
            };

            const lastMessage = prevMessages.at(-1);
            if (lastMessage?.role === 'assistant') {
              return [...prevMessages.slice(0, -1), aiMessage];
            }
            return [...prevMessages, aiMessage];
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
