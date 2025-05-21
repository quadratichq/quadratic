import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useFilesContextMessages } from '@/app/ai/hooks/useFilesContextMessages';
import { useOtherSheetsContextMessages } from '@/app/ai/hooks/useOtherSheetsContextMessages';
import { useSelectionContextMessages } from '@/app/ai/hooks/useSelectionContextMessages';
import { useTablesContextMessages } from '@/app/ai/hooks/useTablesContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystDelaySecondsAtom,
  aiAnalystLoadingAtom,
  aiAnalystPDFImportAtom,
  aiAnalystPromptSuggestionsAtom,
  aiAnalystShowChatHistoryAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useAnalystPDFImport } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystPDFImport';
import { apiClient } from '@/shared/api/apiClient';
import mixpanel from 'mixpanel-browser';
import { getLastAIPromptMessageIndex, getPromptMessagesWithoutPDF } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import { AITool, aiToolsSpec, type AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIMessage, ChatMessage, Content, Context, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRef } from 'react';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

const USE_STREAM = true;
const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAnalystPromptArgs = {
  content: Content;
  context: Context;
  messageIndex: number;
  onSubmit?: () => void;
};

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getOtherSheetsContext } = useOtherSheetsContextMessages();
  const { getTablesContext } = useTablesContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const { getFilesContext } = useFilesContextMessages();
  const { importPDF } = useAnalystPDFImport();
  const [modelKey] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    () =>
      async ({ context, chatMessages }: { context: Context; chatMessages: ChatMessage[] }): Promise<ChatMessage[]> => {
        const [otherSheetsContext, tablesContext, currentSheetContext, visibleContext, selectionContext, filesContext] =
          await Promise.all([
            getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
            getTablesContext(),
            getCurrentSheetContext({ currentSheetName: context.currentSheet }),
            getVisibleContext(),
            getSelectionContext({ selection: context.selection }),
            getFilesContext({ chatMessages }),
          ]);

        const messagesWithContext: ChatMessage[] = [
          ...otherSheetsContext,
          ...tablesContext,
          ...currentSheetContext,
          ...visibleContext,
          ...selectionContext,
          ...filesContext,
          ...getPromptMessagesWithoutPDF(chatMessages),
        ];

        return messagesWithContext;
      },
    [
      getOtherSheetsContext,
      getTablesContext,
      getCurrentSheetContext,
      getVisibleContext,
      getSelectionContext,
      getFilesContext,
    ]
  );

  const delayTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ content, context, messageIndex, onSubmit }: SubmitAIAnalystPromptArgs) => {
        set(showAIAnalystAtom, true);
        set(aiAnalystShowChatHistoryAtom, false);

        // abort and clear prompt suggestions
        set(aiAnalystPromptSuggestionsAtom, (prev) => {
          prev.abortController?.abort();
          return {
            abortController: undefined,
            suggestions: [],
          };
        });

        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;

        const currentMessageCount = await snapshot.getPromise(aiAnalystCurrentChatMessagesCountAtom);
        if (messageIndex === 0) {
          set(aiAnalystCurrentChatAtom, {
            id: v4(),
            name: '',
            lastUpdated: Date.now(),
            messages: [],
          });
        }
        // fork chat, if we are editing an existing chat
        else if (messageIndex < currentMessageCount) {
          set(aiAnalystCurrentChatAtom, (prev) => {
            return {
              id: v4(),
              name: '',
              lastUpdated: Date.now(),
              messages: prev.messages.slice(0, messageIndex),
            };
          });
        }

        let chatMessages: ChatMessage[] = [];
        if (!onSubmit) {
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
            chatMessages = [
              ...prevMessages,
              {
                role: 'user' as const,
                content,
                contextType: 'userPrompt' as const,
                context: {
                  ...context,
                  selection: context.selection ?? sheets.sheet.cursor.save(),
                },
              },
            ];
            return chatMessages;
          });
        }

        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
          let prevWaitingOnMessageIndex: number | undefined = undefined;
          clearTimeout(delayTimerRef.current);
          set(aiAnalystWaitingOnMessageIndexAtom, (prev) => {
            prevWaitingOnMessageIndex = prev;
            return undefined;
          });
          set(aiAnalystPDFImportAtom, (prev) => {
            prev.abortController?.abort();
            return { abortController: undefined, loading: false };
          });

          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
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
                model: getModelFromModelKey(modelKey),
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });

          clearTimeout(delayTimerRef.current);
          set(aiAnalystWaitingOnMessageIndexAtom, undefined);
        });
        set(aiAnalystAbortControllerAtom, abortController);

        const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
        const { exceededBillingLimit, currentPeriodUsage, billingLimit } =
          await apiClient.teams.billing.aiUsage(teamUuid);
        if (exceededBillingLimit) {
          // let localDelaySeconds = AI_FREE_TIER_WAIT_TIME_SECONDS + Math.ceil((currentPeriodUsage ?? 0) * 0.25);
          let localDelaySeconds = 999999999;
          set(aiAnalystDelaySecondsAtom, localDelaySeconds);
          set(aiAnalystWaitingOnMessageIndexAtom, messageIndex);

          mixpanel.track('[Billing].ai.exceededBillingLimit', {
            exceededBillingLimit: exceededBillingLimit,
            billingLimit: billingLimit,
            currentPeriodUsage: currentPeriodUsage,
            localDelaySeconds: localDelaySeconds,
            location: 'AIAnalyst',
          });

          await new Promise<void>((resolve) => {
            const resolveAfterDelay = () => {
              localDelaySeconds -= 1;
              if (localDelaySeconds <= 0) {
                resolve();
              } else {
                set(aiAnalystDelaySecondsAtom, localDelaySeconds);
                clearTimeout(delayTimerRef.current);
                delayTimerRef.current = setTimeout(resolveAfterDelay, 1000);
              }
            };

            resolveAfterDelay();
          });
        }
        set(aiAnalystWaitingOnMessageIndexAtom, undefined);

        if (abortController.signal.aborted) {
          set(aiAnalystAbortControllerAtom, undefined);
          set(aiAnalystLoadingAtom, false);
          return;
        }

        if (onSubmit) {
          onSubmit();
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
            chatMessages = [
              ...prevMessages,
              {
                role: 'user' as const,
                content,
                contextType: 'userPrompt' as const,
                context: {
                  ...context,
                  selection: context.selection ?? sheets.sheet.cursor.save(),
                },
              },
            ];
            return chatMessages;
          });
        }

        set(aiAnalystLoadingAtom, true);

        let lastMessageIndex = -1;
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
          // Handle tool calls
          let toolCallIterations = 0;
          while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
            // Send tool call results to API
            const messagesWithContext = await updateInternalContext({ context, chatMessages });
            lastMessageIndex = getLastAIPromptMessageIndex(messagesWithContext);
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAnalyst',
              modelKey,
              messages: messagesWithContext,
              useStream: USE_STREAM,
              toolName: undefined,
              useToolsPrompt: true,
              language: undefined,
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
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

            let promptSuggestions: z.infer<
              (typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]
            >['prompt_suggestions'] = [];

            for (const toolCall of response.toolCalls) {
              if (toolCall.name === AITool.PDFImport) {
                continue;
              }

              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                try {
                  const aiTool = toolCall.name as AITool;
                  const argsObject = JSON.parse(toolCall.arguments);
                  const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                  const result = await aiToolsActions[aiTool](args as any, {
                    source: 'AIAnalyst',
                    chatId,
                    messageIndex: lastMessageIndex + 1,
                  });
                  toolResultMessage.content.push({
                    id: toolCall.id,
                    text: result,
                  });

                  if (aiTool === AITool.UserPromptSuggestions) {
                    promptSuggestions = (args as any).prompt_suggestions;
                  }
                } catch (error) {
                  toolResultMessage.content.push({
                    id: toolCall.id,
                    text: `Error parsing ${toolCall.name} tool's arguments: ${error}`,
                  });
                }
              } else {
                toolResultMessage.content.push({
                  id: toolCall.id,
                  text: 'Unknown tool',
                });
              }
            }

            const importPDFToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.PDFImport);
            for (const toolCall of importPDFToolCalls) {
              const argsObject = JSON.parse(toolCall.arguments);
              const pdfImportArgs = aiToolsSpec[AITool.PDFImport].responseSchema.parse(argsObject);
              const result = await importPDF({ pdfImportArgs, context, chatMessages });
              toolResultMessage.content.push({
                id: toolCall.id,
                text: result,
              });
            }

            let nextChatMessages: ChatMessage[] = [];
            set(aiAnalystCurrentChatMessagesAtom, (prev) => {
              nextChatMessages = [...prev, toolResultMessage];
              return nextChatMessages;
            });
            chatMessages = nextChatMessages;

            // prompt suggestion requires user input, break the loop
            if (promptSuggestions.length > 0) {
              set(aiAnalystPromptSuggestionsAtom, {
                abortController: undefined,
                suggestions: promptSuggestions,
              });
              break;
            }
          }
        } catch (error) {
          set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => {
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
                model: getModelFromModelKey(modelKey),
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
    [handleAIRequestToAPI, updateInternalContext, modelKey, importPDF]
  );

  return { submitPrompt };
}
