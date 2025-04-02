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
  aiAnalystFilesAtom,
  aiAnalystLoadingAtom,
  aiAnalystPromptSuggestionsAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useAnalystPDFImport } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystPDFImport';
import { isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import { AITool, aiToolsSpec, type AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessage,
  ChatMessage,
  Content,
  Context,
  FileContent,
  ToolResultMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

const USE_STREAM = true;
const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAnalystPromptArgs = {
  content: Content;
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
  const { getFilesContext } = useFilesContextMessages();
  const { importPDF } = useAnalystPDFImport();
  const [modelKey] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ set }) =>
      async ({ context, files }: { context: Context; files: FileContent[] }): Promise<ChatMessage[]> => {
        const [otherSheetsContext, tablesContext, currentSheetContext, visibleContext, selectionContext, filesContext] =
          await Promise.all([
            getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
            getTablesContext(),
            getCurrentSheetContext({ currentSheetName: context.currentSheet }),
            getVisibleContext(),
            getSelectionContext({ selection: context.selection }),
            getFilesContext({ files }),
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
            ...filesContext,
            ...prevMessages,
          ];

          return updatedMessages;
        });

        return updatedMessages;
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

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ content, context, messageIndex, clearMessages }: SubmitAIAnalystPromptArgs) => {
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
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
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
        });
        set(aiAnalystAbortControllerAtom, abortController);

        if (clearMessages) {
          set(aiAnalystFilesAtom, []);
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

        const files = await snapshot.getPromise(aiAnalystFilesAtom);
        const imageFiles = files.filter((file) => isSupportedImageMimeType(file.mimeType));
        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => [
          ...prevMessages,
          {
            role: 'user' as const,
            content: [...imageFiles, ...content],
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
          // Handle tool calls
          let toolCallIterations = 0;
          while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
            // Send tool call results to API
            const updatedMessages = await updateInternalContext({ context, files });
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAnalyst',
              modelKey,
              messages: updatedMessages,
              useStream: USE_STREAM,
              toolName: undefined,
              useToolsPrompt: false,
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
                  const result = await aiToolsActions[aiTool](args as any);
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
                    text: `Error parsing tool arguments: ${error}`,
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
              const args = aiToolsSpec[AITool.PDFImport].responseSchema.parse(argsObject);
              const result = await importPDF({ pdfImportArgs: args, context });
              toolResultMessage.content.push({
                id: toolCall.id,
                text: result,
              });
            }

            set(aiAnalystCurrentChatMessagesAtom, (prev) => [...prev, toolResultMessage]);

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
        set(aiAnalystCurrentChatMessagesAtom, (prevMessages) => [
          ...prevMessages.map((message) => {
            if (message.role !== 'user' || message.contextType !== 'userPrompt') {
              return message;
            } else {
              return {
                ...message,
                content: message.content.filter((item) => item.type !== 'data'),
              };
            }
          }),
        ]);
        set(aiAnalystLoadingAtom, false);
      },
    [handleAIRequestToAPI, updateInternalContext, modelKey, importPDF]
  );

  return { submitPrompt };
}
