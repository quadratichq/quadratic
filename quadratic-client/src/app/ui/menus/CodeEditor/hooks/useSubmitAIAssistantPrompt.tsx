import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { getMessagesForModel } from '@/app/ai/tools/helpers';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  codeEditorCodeCellAtom,
  codeEditorWaitingForEditorClose,
  defaultAIAssistantContext,
  showAIAssistantAtom,
} from '@/app/atoms/codeEditorAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { AIPromptMessage, ChatMessage, Context } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        context = defaultAIAssistantContext,
        clearMessages,
        codeCell,
      }: {
        userPrompt: string;
        context?: Context;
        clearMessages?: boolean;
        codeCell?: CodeCell;
      }) => {
        set(showAIAssistantAtom, true);

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAssistantAbortControllerAtom, abortController);

        if (clearMessages) {
          set(aiAssistantMessagesAtom, []);
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
        context = { ...context, codeCell };

        const quadraticContext = context.quadraticDocs
          ? getQuadraticContext({ language: getLanguage(codeCell.language), model })
          : [];
        const currentSheetContext = context.currentSheet ? await getCurrentSheetContext({ model }) : [];
        const visibleContext = context.visibleData ? await getVisibleContext({ model }) : [];
        const codeContext = context.codeCell ? await getCodeCellContext({ codeCell: context.codeCell, model }) : [];
        let updatedMessages: ChatMessage[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          prevMessages = prevMessages.filter(
            (message) =>
              message.contextType !== 'quadraticDocs' &&
              message.contextType !== 'allSheets' &&
              message.contextType !== 'currentSheet' &&
              message.contextType !== 'visibleData' &&
              message.contextType !== 'toolUse'
          );

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: ChatMessage[] = [
            ...(lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = [
            ...quadraticContext,
            ...currentSheetContext,
            ...visibleContext,
            ...prevMessages,
            ...newContextMessages,
            { role: 'user', content: userPrompt, contextType: 'userPrompt', context },
          ];

          return updatedMessages;
        });

        const messagesToSend: AIPromptMessage[] = getMessagesForModel(model, updatedMessages);

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
    [handleAIRequestToAPI, getQuadraticContext, getCurrentSheetContext, getVisibleContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
