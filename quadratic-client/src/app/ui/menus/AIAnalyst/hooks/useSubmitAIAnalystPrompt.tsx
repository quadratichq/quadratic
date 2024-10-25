import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
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
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIMessage, Context, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export const defaultAIAnalystContext: Context = {
  quadraticDocs: true,
  connections: false,
  allSheets: false,
  currentSheet: true,
  visibleData: true,
  toolUse: true,
  selection: [],
  codeCell: undefined,
};

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getToolUsePrompt } = useToolUseMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        context = defaultAIAnalystContext,
        messageIndex,
        clearMessages,
        codeCell,
        selectionSheetRect,
      }: {
        userPrompt: string;
        context?: Context;
        messageIndex?: number;
        clearMessages?: boolean;
        codeCell?: CodeCell;
        selectionSheetRect?: SheetRect;
      }) => {
        set(showAIAnalystAtom, true);

        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAnalystAbortControllerAtom, abortController);

        // fork chat, if we are editing an existing chat
        if (messageIndex !== undefined) {
          set(aiAnalystCurrentChatAtom, (prev) => {
            return {
              ...prev,
              id: '',
              name: '',
              lastUpdated: Date.now(),
              messages: prev.messages.slice(0, messageIndex),
            };
          });
        }

        if (codeCell) {
          context = { ...context, codeCell };
        }

        if (selectionSheetRect) {
          context = { ...context, selection: [...context.selection, selectionSheetRect] };
        }

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
        const codeContext = context.codeCell ? await getCodeCellContext({ codeCell: context.codeCell, model }) : [];

        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
          prevMessages = prevMessages.filter(
            (message) =>
              message.contextType !== 'quadraticDocs' &&
              message.contextType !== 'allSheets' &&
              message.contextType !== 'currentSheet' &&
              message.contextType !== 'visibleData' &&
              message.contextType !== 'toolUse'
          );

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = [
            ...quadraticContext,
            ...currentSheetContext,
            ...visibleContext,
            ...toolUsePrompt,
            ...selectionContext,
            ...(clearMessages ? [] : prevMessages),
            ...newContextMessages,
            { role: 'user', content: userPrompt, contextType: 'userPrompt', context },
          ];

          return updatedMessages;
        });

        let toolCalls: AIMessage['toolCalls'] | undefined = undefined;
        while (toolCalls === undefined || toolCalls.length > 0) {
          try {
            const response = await handleAIRequestToAPI({
              model,
              messages: getMessagesForModel(model, updatedMessages),
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
              useStream: true,
              useTools: true,
            });

            // TODO(ayush): remove before merge
            console.log('response', response);

            // Handle tool calls
            toolCalls = response.toolCalls;
            if (toolCalls !== undefined && toolCalls.length > 0) {
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
                  const result = await aiToolsSpec[aiTool].action(args);
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

              // Update messages to include tool call results
              let updatedMessages: (UserMessage | AIMessage)[] = [];
              set(aiAnalystCurrentChatMessagesAtom, (prev) => {
                updatedMessages = [...prev, toolResultMessage];
                return updatedMessages;
              });

              // Send tool call results to API
              const response = await handleAIRequestToAPI({
                model,
                messages: getMessagesForModel(model, updatedMessages),
                setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
                signal: abortController.signal,
                useStream: true,
                useTools: true,
              });

              toolCalls = response.toolCalls;

              // TODO(ayush): remove before merge
              console.log('response', response);
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

            toolCalls = [];

            console.error(error);
          }
        }

        set(aiAnalystAbortControllerAtom, undefined);
        set(aiAnalystLoadingAtom, false);
      },
    [
      handleAIRequestToAPI,
      getQuadraticContext,
      getCurrentSheetContext,
      getVisibleContext,
      getToolUsePrompt,
      getSelectionContext,
      getCodeCellContext,
      model,
    ]
  );

  return { submitPrompt };
}
