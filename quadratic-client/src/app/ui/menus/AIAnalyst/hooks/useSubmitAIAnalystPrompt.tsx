import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useFilesContextMessages } from '@/app/ai/hooks/useFilesContextMessages';
import { useOtherSheetsContextMessages } from '@/app/ai/hooks/useOtherSheetsContextMessages';
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
  aiAnalystWebSearchAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { sheets } from '@/app/grid/controller/Sheets';
import { useAnalystPDFImport } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystPDFImport';
import { useAnalystWebSearch } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystWebSearch';
import { apiClient } from '@/shared/api/apiClient';
import mixpanel from 'mixpanel-browser';
import {
  getLastAIPromptMessageIndex,
  getPromptMessagesForAI,
  isContentFile,
  removeOldFilesInToolResult,
  replaceOldGetToolCallResults,
} from 'quadratic-shared/ai/helpers/message.helper';
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

// // Include a screenshot of what the user is seeing
// async function getUserScreen(): Promise<ChatMessage | undefined> {
//   const currentScreen = await getScreenImage();
//   if (currentScreen) {
//     const reader = new FileReader();
//     const base64 = await new Promise<string>((resolve) => {
//       reader.onloadend = () => {
//         const result = reader.result as string;
//         resolve(result.split(',')[1]);
//       };
//       reader.readAsDataURL(currentScreen);
//     });
//     return {
//       role: 'user',
//       content: [{ type: 'data', data: base64, mimeType: 'image/png', fileName: 'screen.png' }],
//       contextType: 'userPrompt',
//     };
//   }
// }

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getOtherSheetsContext } = useOtherSheetsContextMessages();
  const { getTablesContext } = useTablesContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getFilesContext } = useFilesContextMessages();
  const { importPDF } = useAnalystPDFImport();
  const { search } = useAnalystWebSearch();
  const [modelKey] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    () =>
      async ({ context, chatMessages }: { context: Context; chatMessages: ChatMessage[] }): Promise<ChatMessage[]> => {
        const [otherSheetsContext, tablesContext, currentSheetContext, visibleContext, filesContext] =
          await Promise.all([
            getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
            getTablesContext(),
            getCurrentSheetContext({ currentSheetName: context.currentSheet }),
            getVisibleContext(),
            getFilesContext({ chatMessages }),
          ]);

        const messagesWithContext: ChatMessage[] = [
          ...otherSheetsContext,
          ...tablesContext,
          ...currentSheetContext,
          ...visibleContext,
          ...filesContext,
          ...getPromptMessagesForAI(chatMessages),
        ];

        return messagesWithContext;
      },
    [getOtherSheetsContext, getTablesContext, getCurrentSheetContext, getVisibleContext, getFilesContext]
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
          set(aiAnalystWebSearchAtom, (prev) => {
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
                modelKey,
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
                  selection: context.selection ?? sheets.sheet.cursor.toA1String(),
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

            if (debugFlag('debugShowAIInternalContext')) {
              console.log('AIAnalyst messages with context:', {
                context,
                messagesWithContext,
              });
            }
            if (debugFlag('debugPrintAIInternalContext')) {
              console.log(
                messagesWithContext
                  .filter((message) => message.role === 'user' && message.contextType === 'userPrompt')
                  .map((message) => {
                    return `${message.role}: ${message.content.map((content) => {
                      if ('type' in content && content.type === 'text') {
                        return content.text;
                      } else {
                        return 'data';
                      }
                    })}`;
                  })
                  .join('\n')
              );
            }

            lastMessageIndex = getLastAIPromptMessageIndex(messagesWithContext);
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAnalyst',
              modelKey,
              time: new Date().toString(),
              messages: messagesWithContext,
              useStream: USE_STREAM,
              toolName: undefined,
              useToolsPrompt: true,
              language: undefined,
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
            });

            let nextChatMessages: ChatMessage[] = [];
            set(aiAnalystCurrentChatMessagesAtom, (prev) => {
              nextChatMessages = replaceOldGetToolCallResults(prev);
              return nextChatMessages;
            });
            chatMessages = nextChatMessages;

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
              if (toolCall.name === AITool.PDFImport || toolCall.name === AITool.WebSearch) {
                continue;
              }

              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                try {
                  const aiTool = toolCall.name as AITool;
                  const argsObject = JSON.parse(toolCall.arguments);
                  const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                  const toolResultContent = await aiToolsActions[aiTool](args as any, {
                    source: 'AIAnalyst',
                    chatId,
                    messageIndex: lastMessageIndex + 1,
                  });
                  toolResultMessage.content.push({
                    id: toolCall.id,
                    content: toolResultContent,
                  });

                  if (aiTool === AITool.UserPromptSuggestions) {
                    promptSuggestions = (args as any).prompt_suggestions;
                  }
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

            const importPDFToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.PDFImport);
            for (const toolCall of importPDFToolCalls) {
              const argsObject = JSON.parse(toolCall.arguments);
              const pdfImportArgs = aiToolsSpec[AITool.PDFImport].responseSchema.parse(argsObject);
              const toolResultContent = await importPDF({ pdfImportArgs, context, chatMessages });
              toolResultMessage.content.push({
                id: toolCall.id,
                content: toolResultContent,
              });
            }

            const webSearchToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.WebSearch);
            for (const toolCall of webSearchToolCalls) {
              const argsObject = JSON.parse(toolCall.arguments);
              const searchArgs = aiToolsSpec[AITool.WebSearch].responseSchema.parse(argsObject);
              const { toolResultContent, internal } = await search({ searchArgs });
              toolResultMessage.content.push({
                id: toolCall.id,
                content: toolResultContent,
              });

              if (internal) {
                let nextChatMessages: ChatMessage[] = [];
                set(aiAnalystCurrentChatMessagesAtom, (prev) => {
                  nextChatMessages = [...prev, internal];
                  return nextChatMessages;
                });
                chatMessages = nextChatMessages;
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

            set(aiAnalystCurrentChatMessagesAtom, (prev) => {
              nextChatMessages = [...removeOldFilesInToolResult(prev, filesInToolResult), toolResultMessage];
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
                modelKey,
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
    [handleAIRequestToAPI, updateInternalContext, modelKey, importPDF, search]
  );

  return { submitPrompt };
}
