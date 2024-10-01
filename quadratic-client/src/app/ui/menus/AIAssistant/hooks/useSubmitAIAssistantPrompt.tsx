import {
  aiAssistantAbortControllerAtom,
  aiAssistantContextAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  AIAssistantState,
  showAIAssistantAtom,
} from '@/app/atoms/aiAssistantAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCodeCellContextMessages';
import { useCursorSelectionContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCursorSelectionContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useQuadraticContextMessages';
import { useVisibleContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useVisibleContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { quadraticContext } = useQuadraticContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getCursorSelectionContext } = useCursorSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIAssistantModel();

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

        let aiContext: AIAssistantState['context'] = await snapshot.getPromise(aiAssistantContextAtom);
        set(aiAssistantContextAtom, (prev) => {
          aiContext = {
            ...prev,
            codeCell: codeCell ?? prev.codeCell,
          };
          return aiContext;
        });

        const visibleContext = aiContext.visibleData ? await getVisibleContext({ model }) : [];
        const cursorSelectionContext = aiContext.cursorSelection ? await getCursorSelectionContext({ model }) : [];
        const codeContext = aiContext.codeCell ? await getCodeCellContext({ codeCell: aiContext.codeCell, model }) : [];
        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          const lastVisibleContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'visibleData')
            .at(-1);

          const lastCursorSelectionContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'cursorSelection')
            .at(-1);

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastVisibleContext?.content === visibleContext?.[0]?.content ? [] : visibleContext),
            ...(!clearMessages && lastCursorSelectionContext?.content === cursorSelectionContext?.[0]?.content
              ? []
              : cursorSelectionContext),
            ...(!clearMessages && lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = clearMessages
            ? [
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
          ...(aiContext.quadraticDocs ? quadraticContext : []),
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
    [handleAIRequestToAPI, quadraticContext, getVisibleContext, getCursorSelectionContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
