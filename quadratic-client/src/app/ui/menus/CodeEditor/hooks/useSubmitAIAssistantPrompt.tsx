import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantIdAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorWaitingForEditorClose,
  showAIAssistantAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIMessage, ChatMessage, Content, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

const MAX_TOOL_CALL_ITERATIONS = 25;

export type SubmitAIAssistantPromptArgs = {
  content: Content;
  messageIndex?: number;
  clearMessages?: boolean;
  codeCell?: CodeCell;
};

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [modelKey] = useAIModel();

  const updateInternalContext = useRecoilCallback(
    ({ set }) =>
      async ({ codeCell }: { codeCell: CodeCell }): Promise<ChatMessage[]> => {
        const [currentSheetContext, visibleContext, codeContext] = await Promise.all([
          getCurrentSheetContext({ currentSheetName: sheets.sheet.name }),
          getVisibleContext(),
          getCodeCellContext({ codeCell }),
        ]);
        let updatedMessages: ChatMessage[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          prevMessages = getPromptMessages(prevMessages);

          updatedMessages = [...currentSheetContext, ...visibleContext, ...codeContext, ...prevMessages];

          return updatedMessages;
        });

        return updatedMessages;
      },
    [getCurrentSheetContext, getVisibleContext, getCodeCellContext]
  );

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ content, messageIndex, clearMessages, codeCell }: SubmitAIAssistantPromptArgs) => {
        set(showAIAssistantAtom, true);

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
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
        set(aiAssistantAbortControllerAtom, abortController);

        if (clearMessages) {
          set(aiAssistantIdAtom, v4());
          set(aiAssistantMessagesAtom, []);
        }

        // fork chat, if we are editing an existing chat
        if (messageIndex !== undefined) {
          set(aiAssistantIdAtom, v4());
          set(aiAssistantMessagesAtom, (prev) => prev.slice(0, messageIndex));
        }

        set(codeEditorDiffEditorContentAtom, undefined);
        const currentCodeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        if (codeCell) {
          if (
            codeCell.sheetId !== currentCodeCell.sheetId ||
            codeCell.pos.x !== currentCodeCell.pos.x ||
            codeCell.pos.y !== currentCodeCell.pos.y ||
            codeCell.language !== currentCodeCell.language
          ) {
            set(codeEditorWaitingForEditorClose, {
              codeCell,
              showCellTypeMenu: false,
              initialCode: '',
              inlineEditor: false,
            });
          }
        } else {
          codeCell = { ...currentCodeCell };
        }

        set(aiAssistantMessagesAtom, (prevMessages) => [
          ...prevMessages,
          {
            role: 'user' as const,
            content,
            contextType: 'userPrompt' as const,
          },
        ]);

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
            const updatedMessages = await updateInternalContext({ codeCell });
            const response = await handleAIRequestToAPI({
              chatId,
              source: 'AIAssistant',
              modelKey,
              messages: updatedMessages,
              useStream: true,
              toolName: undefined,
              useToolsPrompt: true,
              language: getLanguage(codeCell.language),
              useQuadraticContext: true,
              setMessages: (updater) => set(aiAssistantMessagesAtom, updater),
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

            for (const toolCall of response.toolCalls) {
              if (Object.values(AITool).includes(toolCall.name as AITool)) {
                const aiTool = toolCall.name as AITool;
                const argsObject = JSON.parse(toolCall.arguments);
                const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                const result = await aiToolsActions[aiTool](args as any);
                toolResultMessage.content.push({
                  id: toolCall.id,
                  text: result,
                });
              } else {
                toolResultMessage.content.push({
                  id: toolCall.id,
                  text: 'Unknown tool',
                });
              }
            }

            set(aiAssistantMessagesAtom, (prev) => [...prev, toolResultMessage]);
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
                model: getModelFromModelKey(modelKey),
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
