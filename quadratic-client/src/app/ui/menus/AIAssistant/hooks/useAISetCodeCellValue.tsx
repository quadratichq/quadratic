import {
  aiAssistantAbortControllerAtom,
  aiAssistantContextAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  AIAssistantState,
} from '@/app/atoms/aiAssistantAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useQuadraticContextMessages';
import { useSelectionContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useSelectionContextMessages';
import { useSetCodeCellValueMessages } from '@/app/ui/menus/AIAssistant/hooks/useSetCodeCellValueMessages';

import { useVisibleContextMessages } from '@/app/ui/menus/AIAssistant/hooks/useVisibleContextMessages';
import { AI_TOOL_DEFINITIONS } from '@/app/ui/menus/AIAssistant/TOOLS';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useAISetCodeCellValue() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const { getSetCodeCellValuePrompt } = useSetCodeCellValueMessages();
  const [model] = useAIAssistantModel();

  const aiSetCodeCellValue = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ language, text }: { language: string; text: string }) => {
        const previousLoading = await snapshot.getPromise(aiAssistantLoadingAtom);
        if (previousLoading) return;
        set(aiAssistantLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAssistantAbortControllerAtom, abortController);

        const aiContext: AIAssistantState['context'] = await snapshot.getPromise(aiAssistantContextAtom);

        const quadraticContext = getQuadraticContext(getLanguage(aiContext.codeCell?.language), model);
        const sheetContext = await getCurrentSheetContext({ model });
        const visibleContext = await getVisibleContext({ model });
        const selectionContext = await getSelectionContext({
          sheetRect: aiContext.selection,
          model,
        });
        const codeContext = await getCodeCellContext({ codeCell: aiContext.codeCell, model });
        const setCodeCellValuePrompt = getSetCodeCellValuePrompt({ language, text, model });

        const prevMessages = await snapshot.getPromise(aiAssistantMessagesAtom);
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
          ...(lastQuadraticContext?.content === quadraticContext?.[0]?.content ? [] : quadraticContext),
          ...(lastSheetContext?.content === sheetContext?.[0]?.content ? [] : sheetContext),
          ...(lastVisibleContext?.content === visibleContext?.[0]?.content ? [] : visibleContext),
          ...(lastSelectionContext?.content === selectionContext?.[0]?.content ? [] : selectionContext),
          ...(lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
        ];

        const updatedMessages: (UserMessage | AIMessage)[] = [
          ...prevMessages,
          ...newContextMessages,
          setCodeCellValuePrompt,
        ];

        set(aiAssistantPromptAtom, '');

        const messagesToSend: PromptMessage[] = [
          ...updatedMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ];

        const response = await handleAIRequestToAPI({
          model,
          messages: messagesToSend,
          signal: abortController.signal,
          useStream: false,
          useTools: true,
          toolChoice: 'SetCodeCellValue',
        });

        set(aiAssistantAbortControllerAtom, undefined);
        set(aiAssistantLoadingAtom, false);

        const responseSchema = AI_TOOL_DEFINITIONS['SetCodeCellValue'].responseSchema;

        if (response.functionCalls && response.functionCalls.length > 0) {
          const functionCall = response.functionCalls.find((functionCall) => functionCall.name === 'SetCodeCellValue');
          if (functionCall) {
            try {
              const argsObject = JSON.parse(functionCall.arguments);
              return responseSchema.parse(argsObject);
            } catch (e) {
              console.error('[useAISetCodeCellValue] Error parsing SetCodeCellValue response: ', e);
            }
          }
        }
      },
    [
      handleAIRequestToAPI,
      getQuadraticContext,
      getCurrentSheetContext,
      getVisibleContext,
      getSelectionContext,
      getCodeCellContext,
      getSetCodeCellValuePrompt,
      model,
    ]
  );

  return { aiSetCodeCellValue };
}
