import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantIdAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  codeEditorCodeCellAtom,
  codeEditorWaitingForEditorClose,
  showAIAssistantAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CodeCell } from '@/app/gridGL/types/codeCell';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIMessage, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        messageIndex,
        clearMessages,
        codeCell,
      }: {
        userPrompt: string;
        messageIndex?: number;
        clearMessages?: boolean;
        codeCell?: CodeCell;
      }) => {
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

        if (codeCell) {
          set(codeEditorWaitingForEditorClose, {
            codeCell,
            showCellTypeMenu: false,
            initialCode: '',
            inlineEditor: false,
          });
        } else {
          codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        }

        const currentSheetContext = await getCurrentSheetContext({ currentSheetName: sheets.sheet.name });
        const visibleContext = await getVisibleContext();
        const codeContext = await getCodeCellContext({ codeCell });
        let updatedMessages: ChatMessage[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          prevMessages = getPromptMessages(prevMessages);

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: ChatMessage[] = [
            ...(lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = [
            ...currentSheetContext,
            ...visibleContext,
            ...prevMessages,
            ...newContextMessages,
            { role: 'user', content: userPrompt, contextType: 'userPrompt' },
          ];

          return updatedMessages;
        });

        let chatId = '';
        set(aiAssistantIdAtom, (prev) => {
          chatId = prev ? prev : v4();
          return chatId;
        });

        try {
          await handleAIRequestToAPI({
            chatId,
            source: 'AIAssistant',
            model,
            messages: updatedMessages,
            language: getLanguage(codeCell.language),
            useQuadraticContext: true,
            setMessages: (updater) => set(aiAssistantMessagesAtom, updater),
            signal: abortController.signal,
          });
        } catch (error) {
          set(aiAssistantMessagesAtom, (prevMessages) => {
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

        set(aiAssistantAbortControllerAtom, undefined);
        set(aiAssistantLoadingAtom, false);
      },
    [handleAIRequestToAPI, getCurrentSheetContext, getVisibleContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
