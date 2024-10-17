import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { useSelectionContextMessages } from '@/app/ai/hooks/useSelectionContextMessages';
import { useSetCodeCellValueMessages } from '@/app/ai/hooks/useSetCodeCellValueMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { AI_TOOL_DEFINITIONS } from '@/app/ai/TOOLS';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystContextAtom,
  aiAnalystLoadingAtom,
  aiAnalystMessagesAtom,
  aiAnalystPromptAtom,
  AIAnalystState,
} from '@/app/atoms/aiAnalystAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';

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
  const [model] = useAIModel();

  const aiSetCodeCellValue = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ language, text }: { language: string; text: string }) => {
        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAnalystAbortControllerAtom, abortController);

        const aiContext: AIAnalystState['context'] = await snapshot.getPromise(aiAnalystContextAtom);

        const quadraticContext = getQuadraticContext(getLanguage(aiContext.codeCell?.language), model);
        const sheetContext = await getCurrentSheetContext({ model });
        const visibleContext = await getVisibleContext({ model });
        const selectionContext = await getSelectionContext({
          sheetRect: aiContext.selection,
          model,
        });
        const codeContext = await getCodeCellContext({ codeCell: aiContext.codeCell, model });
        const setCodeCellValuePrompt = getSetCodeCellValuePrompt({ language, text, model });

        const prevMessages = (await snapshot.getPromise(aiAnalystMessagesAtom)).filter(
          (message) =>
            message.contextType !== 'quadraticDocs' &&
            message.contextType !== 'allSheets' &&
            message.contextType !== 'currentSheet' &&
            message.contextType !== 'visibleData'
        );

        const lastSelectionContext = prevMessages
          .filter((message) => message.role === 'user' && message.contextType === 'selection')
          .at(-1);

        const lastCodeContext = prevMessages
          .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
          .at(-1);

        const newContextMessages: (UserMessage | AIMessage)[] = [
          ...(lastSelectionContext?.content === selectionContext?.[0]?.content ? [] : selectionContext),
          ...(lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
        ];

        const updatedMessages: (UserMessage | AIMessage)[] = [
          ...quadraticContext,
          ...sheetContext,
          ...visibleContext,
          ...prevMessages,
          ...newContextMessages,
          setCodeCellValuePrompt,
        ];

        set(aiAnalystPromptAtom, '');

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

        set(aiAnalystAbortControllerAtom, undefined);
        set(aiAnalystLoadingAtom, false);

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
