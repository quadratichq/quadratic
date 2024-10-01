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
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/useCodeCellContextMessages';
import { useCursorSelectionContextMessages } from '@/app/ui/menus/AIAssistant/useCursorSelectionContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/useQuadraticContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { quadraticContext } = useQuadraticContextMessages();
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

        const contextMessages: (UserMessage | AIMessage)[] = [];
        if (aiContext.cursorSelection) {
          const cursorContext = await getCursorSelectionContext({ model });
          contextMessages.push(...cursorContext);
        }
        if (aiContext.codeCell) {
          const codeContext = await getCodeCellContext({ codeCell: aiContext.codeCell, model });
          contextMessages.push(...codeContext);
        }

        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          updatedMessages = clearMessages
            ? [...contextMessages, { role: 'user', content: userPrompt, internalContext: false }]
            : [...prevMessages, ...contextMessages, { role: 'user', content: userPrompt, internalContext: false }];
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
    [handleAIRequestToAPI, quadraticContext, getCursorSelectionContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
