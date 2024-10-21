import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ai/hooks/useCodeCellContextMessages';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useQuadraticContextMessages } from '@/app/ai/hooks/useQuadraticContextMessages';
import { useSelectionContextMessages } from '@/app/ai/hooks/useSelectionContextMessages';
import { useToolUseMessages } from '@/app/ai/hooks/useToolUseMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { AI_TOOLS, AITool } from '@/app/ai/tools/aiTools';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystContextAtom,
  aiAnalystLoadingAtom,
  aiAnalystMessagesAtom,
  AIAnalystState,
  defaultAIAnalystState,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSubmitAIAnalystPrompt() {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getQuadraticContext } = useQuadraticContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getToolUsePrompt } = useToolUseMessages();
  const { getSelectionContext } = useSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();
  const [model] = useAIModel();

  const submitPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        userPrompt,
        messageIndex,
        clearMessages,
        codeCell,
        selectionSheetRect,
      }: {
        userPrompt: string;
        messageIndex?: number;
        clearMessages?: boolean;
        codeCell?: CodeCell;
        selectionSheetRect?: SheetRect;
      }) => {
        set(showAIAnalystAtom, true);

        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;
        set(aiAnalystLoadingAtom, true);

        const abortController = new AbortController();
        set(aiAnalystAbortControllerAtom, abortController);

        let aiContext: AIAnalystState['context'] = await snapshot.getPromise(aiAnalystContextAtom);
        set(aiAnalystContextAtom, (prev) => {
          aiContext = !!codeCell
            ? {
                ...defaultAIAnalystState['context'],
                codeCell: codeCell,
              }
            : !!selectionSheetRect
            ? {
                ...defaultAIAnalystState['context'],
                selection: selectionSheetRect,
              }
            : prev;
          return aiContext;
        });

        const quadraticContext = aiContext.quadraticDocs
          ? getQuadraticContext(aiContext.codeCell ? getLanguage(aiContext.codeCell.language) : undefined, model)
          : [];
        const sheetContext = aiContext.currentSheet ? await getCurrentSheetContext({ model }) : [];
        const visibleContext = aiContext.visibleData ? await getVisibleContext({ model }) : [];
        const toolUsePrompt = aiContext.toolUse ? getToolUsePrompt({ model }) : [];
        const selectionContext = await getSelectionContext({
          sheetRect: aiContext.selection,
          model,
        });
        const codeContext = await getCodeCellContext({ codeCell: aiContext.codeCell, model });
        let updatedMessages: (UserMessage | AIMessage)[] = [];
        set(aiAnalystMessagesAtom, (prevMessages) => {
          if (messageIndex !== undefined) {
            prevMessages = prevMessages.slice(0, messageIndex);
          }

          prevMessages = prevMessages.filter(
            (message) =>
              message.contextType !== 'quadraticDocs' &&
              message.contextType !== 'allSheets' &&
              message.contextType !== 'currentSheet' &&
              message.contextType !== 'visibleData' &&
              message.contextType !== 'toolUse'
          );

          const lastSelectionContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'selection')
            .at(-1);

          const lastCodeContext = prevMessages
            .filter((message) => message.role === 'user' && message.contextType === 'codeCell')
            .at(-1);

          const newContextMessages: (UserMessage | AIMessage)[] = [
            ...(!clearMessages && lastSelectionContext?.content === selectionContext?.[0]?.content
              ? []
              : selectionContext),
            ...(!clearMessages && lastCodeContext?.content === codeContext?.[0]?.content ? [] : codeContext),
          ];

          updatedMessages = [
            ...quadraticContext,
            ...sheetContext,
            ...visibleContext,
            ...toolUsePrompt,
            ...(clearMessages ? [] : prevMessages),
            ...newContextMessages,
            { role: 'user', content: userPrompt, internalContext: false, contextType: 'userPrompt' },
          ];

          return updatedMessages;
        });

        const messagesToSend: PromptMessage[] = [
          ...updatedMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ];
        try {
          const response = await handleAIRequestToAPI({
            model,
            messages: messagesToSend,
            setMessages: (updater) => set(aiAnalystMessagesAtom, updater),
            signal: abortController.signal,
            useStream: true,
            useTools: true,
          });

          if (response.functionCalls && response.functionCalls.length > 0) {
            for (const functionCall of response.functionCalls) {
              if (Object.values(AITool).includes(functionCall.name as AITool)) {
                const aiTool = functionCall.name as AITool;
                const argsObject = JSON.parse(functionCall.arguments);
                const args = AI_TOOLS[aiTool].responseSchema.parse(argsObject);
                await AI_TOOLS[aiTool].action(args);
              }
            }
          }
        } catch (error) {
          console.error(error);
        }

        set(aiAnalystAbortControllerAtom, undefined);
        set(aiAnalystLoadingAtom, false);
      },
    [
      handleAIRequestToAPI,
      getQuadraticContext,
      getCurrentSheetContext,
      getVisibleContext,
      getToolUsePrompt,
      getSelectionContext,
      getCodeCellContext,
      model,
    ]
  );

  return { submitPrompt };
}
