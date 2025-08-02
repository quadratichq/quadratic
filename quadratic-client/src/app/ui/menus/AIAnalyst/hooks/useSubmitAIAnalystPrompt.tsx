import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentDateTimeContextMessages } from '@/app/ai/hooks/useCurrentDateTimeContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useFilesContextMessages } from '@/app/ai/hooks/useFilesContextMessages';
import { useGetUserPromptSuggestions } from '@/app/ai/hooks/useGetUserPromptSuggestions';
import { useOtherSheetsContextMessages } from '@/app/ai/hooks/useOtherSheetsContextMessages';
import { useSheetInfoMessages } from '@/app/ai/hooks/useSheetInfoMessages';
import { useSqlContextMessages } from '@/app/ai/hooks/useSqlContextMessages';
import { useTablesContextMessages } from '@/app/ai/hooks/useTablesContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystPDFImportAtom,
  aiAnalystPromptSuggestionsAtom,
  aiAnalystShowChatHistoryAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  aiAnalystWebSearchAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useAnalystPDFImport } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystPDFImport';
import { useAnalystWebSearch } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystWebSearch';
import mixpanel from 'mixpanel-browser';
import {
  getLastAIPromptMessageIndex,
  getMessagesForAI,
  getPromptAndInternalMessages,
  getUserPromptMessages,
  isContentFile,
  removeOldFilesInToolResult,
  replaceOldGetToolCallResults,
} from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec, type AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIMessage, ChatMessage, Content, Context, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

const USE_STREAM = true;
const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAnalystPromptArgs = {
  chatId?: string;
  messageSource: string;
  content: Content;
  context: Context;
  messageIndex: number;
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
  const aiModel = useAIModel();
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getCurrentDateTimeContext } = useCurrentDateTimeContextMessages();
  const { getOtherSheetsContext } = useOtherSheetsContextMessages();
  const { getSheetInfoContext } = useSheetInfoMessages();
  const { getTablesContext } = useTablesContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getFilesContext } = useFilesContextMessages();
  const { importPDF } = useAnalystPDFImport();
  const { search } = useAnalystWebSearch();
  const { getUserPromptSuggestions } = useGetUserPromptSuggestions();
  const { getSqlContext } = useSqlContextMessages();

  const updateInternalContext = useRecoilCallback(
    () =>
      async ({ context, chatMessages }: { context: Context; chatMessages: ChatMessage[] }): Promise<ChatMessage[]> => {
        const [
          sqlContext,
          filesContext,
          sheetInfoContext,
          otherSheetsContext,
          tablesContext,
          currentSheetContext,
          visibleContext,
        ] = await Promise.all([
          getSqlContext(),
          getFilesContext({ chatMessages }),
          getSheetInfoContext({ sheets: sheets.sheets }),
          getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
          getTablesContext(),
          getCurrentSheetContext({ currentSheetName: context.currentSheet }),
          getVisibleContext(),
        ]);

        const messagesWithContext: ChatMessage[] = [
          ...sqlContext,
          ...filesContext,
          ...sheetInfoContext,
          ...otherSheetsContext,
          ...tablesContext,
          ...getCurrentDateTimeContext(),
          ...currentSheetContext,
          ...visibleContext,
          ...getPromptAndInternalMessages(chatMessages),
        ];

        return messagesWithContext;
      },
    [
      getCurrentDateTimeContext,
      getOtherSheetsContext,
      getTablesContext,
      getCurrentSheetContext,
      getVisibleContext,
      getFilesContext,
      getSheetInfoContext,
      getSqlContext,
    ]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ chatId: promptChatId, messageSource, content, context, messageIndex }: SubmitAIAnalystPromptArgs) => {
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
            id: promptChatId ?? v4(),
            name: '',
            lastUpdated: Date.now(),
            messages: [],
          });
        }
        // fork chat, if we are editing an existing chat
        else if (messageIndex < currentMessageCount) {
          set(aiAnalystCurrentChatAtom, (prev) => {
            return {
              id: promptChatId ?? v4(),
              name: '',
              lastUpdated: Date.now(),
              messages: prev.messages.slice(0, messageIndex),
            };
          });
        }

        const onExceededBillingLimit = (exceededBillingLimit: boolean) => {
          if (!exceededBillingLimit) {
            return;
          }

          set(aiAnalystCurrentChatMessagesAtom, (prev) => {
            const currentMessage = [...prev];
            currentMessage.pop();
            messageIndex = currentMessage.length - 1;
            return currentMessage;
          });

          set(aiAnalystWaitingOnMessageIndexAtom, messageIndex);

          mixpanel.track('[Billing].ai.exceededBillingLimit', {
            exceededBillingLimit: exceededBillingLimit,
            location: 'AIAnalyst',
          });
        };

        let chatMessages: ChatMessage[] = [];
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
        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
          let prevWaitingOnMessageIndex: number | undefined = undefined;
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
                modelKey: aiModel.modelKey,
              };
              return [...prevMessages, newLastMessage];
            }
            return prevMessages;
          });

          set(aiAnalystWaitingOnMessageIndexAtom, undefined);
        });
        set(aiAnalystAbortControllerAtom, abortController);

        set(aiAnalystLoadingAtom, true);

        let lastMessageIndex = -1;
        let chatId = '';
        set(aiAnalystCurrentChatAtom, (prev) => {
          chatId = prev.id ? prev.id : (promptChatId ?? v4());
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
            chatMessages = await updateInternalContext({ context, chatMessages });
            set(aiAnalystCurrentChatMessagesAtom, chatMessages);

            const messagesForAI = getMessagesForAI(chatMessages);
            lastMessageIndex = getLastAIPromptMessageIndex(messagesForAI);

            if (debugFlag('debugLogJsonAIInternalContext')) {
              console.log('AIAnalyst messages with context:', {
                context,
                messagesForAI,
              });
            }

            if (debugFlag('debugLogReadableAIInternalContext')) {
              console.log(
                getUserPromptMessages(messagesForAI)
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

            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAnalyst',
              messageSource,
              modelKey: aiModel.modelKey,
              messages: messagesForAI,
              useStream: USE_STREAM,
              toolName: undefined,
              useToolsPrompt: true,
              language: undefined,
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAnalystCurrentChatMessagesAtom, updater),
              signal: abortController.signal,
              onExceededBillingLimit,
            });

            const waitingOnMessageIndex = await snapshot.getPromise(aiAnalystWaitingOnMessageIndexAtom);
            if (waitingOnMessageIndex !== undefined) {
              break;
            }

            if (response.error) {
              break;
            }

            let nextChatMessages: ChatMessage[] = [];
            set(aiAnalystCurrentChatMessagesAtom, (prev) => {
              nextChatMessages = replaceOldGetToolCallResults(prev);
              return nextChatMessages;
            });
            chatMessages = nextChatMessages;

            if (response.toolCalls.length === 0) {
              getUserPromptSuggestions();
              break;
            }

            messageSource = response.toolCalls.map((toolCall) => toolCall.name).join(', ');

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
                  inlineEditorHandler.close({ skipFocusGrid: true });
                  const aiTool = toolCall.name as AITool;
                  const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
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
              const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
              const pdfImportArgs = aiToolsSpec[AITool.PDFImport].responseSchema.parse(argsObject);
              const toolResultContent = await importPDF({ pdfImportArgs, context, chatMessages });
              toolResultMessage.content.push({
                id: toolCall.id,
                content: toolResultContent,
              });
            }

            const webSearchToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.WebSearch);
            for (const toolCall of webSearchToolCalls) {
              const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
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
                modelKey: aiModel.modelKey,
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
    [aiModel.modelKey, handleAIRequestToAPI, updateInternalContext, importPDF, search, getUserPromptSuggestions]
  );

  return { submitPrompt };
}
