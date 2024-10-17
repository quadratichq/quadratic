import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  codeEditorCodeCellAtom,
  codeEditorWaitingForEditorClose,
  showAIAssistantAtom,
} from '@/app/atoms/codeEditorAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        clearMessages,
        codeCell,
      }: {
        userPrompt: string;
        clearMessages?: boolean;
        codeCell?: CodeCell;
      }) => {
        set(showAIAssistantAtom, true);

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAssistantAbortControllerAtom, abortController);

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
        const quadraticContext = getQuadraticContext(getLanguage(codeCell.language), model);
        const codeContext = await getCodeCellContext({ codeCell, model });
        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          prevMessages = prevMessages.filter((message) => message.contextType !== 'quadraticDocs');

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = [
            ...quadraticContext,
            ...(clearMessages ? [] : prevMessages),
            ...newContextMessages,
            { role: 'user', content: userPrompt, internalContext: false, contextType: 'userPrompt' },
          ];

          return updatedMessages;
        });

        set(aiAssistantPromptAtom, '');

        const messagesToSend: PromptMessage[] = [
          ...updatedMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ];
        try {
          await handleAIRequestToAPI({
            model,
            messages: messagesToSend,
            setMessages: (updater) => set(aiAssistantMessagesAtom, updater),
            signal: abortController.signal,
          });
        } catch (error) {
          console.error(error);
        }

        set(aiAssistantAbortControllerAtom, undefined);
        set(aiAssistantLoadingAtom, false);
      },
    [handleAIRequestToAPI, getQuadraticContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
