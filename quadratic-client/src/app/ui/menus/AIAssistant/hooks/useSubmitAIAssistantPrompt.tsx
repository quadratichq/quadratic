import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
} from '@/app/atoms/aiAssistantAtom';
import { codeEditorCodeCellAtom, codeEditorPanelBottomActiveTabAtom } from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCodeCellContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useQuadraticContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIAssistantModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ userPrompt, clearMessages }: { userPrompt: string; clearMessages?: boolean }) => {
        set(codeEditorPanelBottomActiveTabAtom, 'ai-assistant');

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAssistantAbortControllerAtom, abortController);

        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        const quadraticContext = getQuadraticContext(getLanguage(codeCell.language), model);
        const codeContext = await getCodeCellContext({ codeCell, model });
        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          const lastQuadraticContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'quadraticDocs')
            .at(-1);
          if (lastQuadraticContext?.content !== quadraticContext?.[0]?.content) {
            prevMessages = [
              ...quadraticContext,
              ...prevMessages.filter((message) => message.contextType !== 'quadraticDocs'),
            ];
          }

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = clearMessages
            ? [
                ...quadraticContext,
                ...newContextMessages,
                { role: 'user', content: userPrompt, internalContext: false, contextType: 'userPrompt' },
              ]
            : [
                ...prevMessages,
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
