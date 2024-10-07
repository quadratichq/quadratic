import {
  aiAssistantAbortControllerAtom,
  aiAssistantContextAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  AIAssistantState,
  defaultAIAssistantState,
  showAIAssistantAtom,
} from '@/app/atoms/aiAssistantAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { SheetRect } from '@/app/quadratic-core-types';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useQuadraticContextMessages';
import { useSelectionContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useSelectionContextMessages';
import { useVisibleContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useVisibleContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIAssistantModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        clearMessages,
        codeCell,
        selectionSheetRect,
      }: {
        userPrompt: string;
        clearMessages?: boolean;
        codeCell?: CodeCell;
        selectionSheetRect?: SheetRect;
      }) => {
        set(showAIAssistantAtom, true);

        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAssistantAbortControllerAtom, abortController);

        let aiContext: AIAssistantState['context'] = await snapshot.getPromise(aiAssistantContextAtom);
        set(aiAssistantContextAtom, (prev) => {
          aiContext = !!codeCell
            ? {
                ...defaultAIAssistantState['context'],
                codeCell: codeCell,
              }
            : !!selectionSheetRect
            ? {
                ...defaultAIAssistantState['context'],
                selection: selectionSheetRect,
              }
            : prev;
          return aiContext;
        });

        const quadraticContext = aiContext.quadraticDocs
          ? getQuadraticContext(getLanguage(aiContext.codeCell?.language), model)
          : [];
        const sheetContext = aiContext.currentSheet ? await getCurrentSheetContext({ model }) : [];
        const visibleContext = aiContext.visibleData ? await getVisibleContext({ model }) : [];
        const selectionContext = await getSelectionContext({
          sheetRect: aiContext.selection,
          model,
        });
        const codeContext = await getCodeCellContext({ codeCell: aiContext.codeCell, model });
        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAssistantMessagesAtom, (prevMessages) => {
          const lastQuadraticContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'quadraticDocs')
            .at(-1);

          const lastSheetContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'currentSheet')
            .at(-1);

          const lastVisibleContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'visibleData')
            .at(-1);

          const lastSelectionContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'selection')
            .at(-1);

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastQuadraticContext?.content === quadraticContext?.[0]?.content
              ? []
              : quadraticContext),
            ...(!clearMessages && lastSheetContext?.content === sheetContext?.[0]?.content ? [] : sheetContext),
            ...(!clearMessages && lastVisibleContext?.content === visibleContext?.[0]?.content ? [] : visibleContext),
            ...(!clearMessages && lastSelectionContext?.content === selectionContext?.[0]?.content
              ? []
              : selectionContext),
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
    [handleAIRequestToAPI, getQuadraticContext, getVisibleContext, getSelectionContext, getCodeCellContext, model]
  );

  return { submitPrompt };
}
