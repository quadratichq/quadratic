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
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/useCodeCellContextMessages';
import { useCursorSelectionContextMessages } from '@/app/ui/menus/AIAssistant/useCursorSelectionContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/useQuadraticContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const setAbortController = useSetRecoilState(aiAssistantAbortControllerAtom);
  const setLoading = useSetRecoilState(aiAssistantLoadingAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);
  const setPrompt = useSetRecoilState(aiAssistantPromptAtom);
  const setAIContext = useSetRecoilState(aiAssistantContextAtom);
  const [model] = useAIAssistantModel();
  const handleAIRequestToAPI = useAIRequestToAPI();
  const setShowAIAssistant = useSetRecoilState(showAIAssistantAtom);
  const { quadraticContext } = useQuadraticContextMessages();
  const { getCursorSelectionContext } = useCursorSelectionContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();

  const submitPrompt = useCallback(
    async ({
      userPrompt,
      clearMessages,
      codeCell,
    }: {
      userPrompt: string;
      clearMessages?: boolean;
      codeCell?: CodeCell;
    }) => {
      setShowAIAssistant(true);

      let previousLoading = false;
      setLoading((prev) => {
        previousLoading = prev;
        return true;
      });
      if (previousLoading) return;

      const abortController = new AbortController();
      setAbortController(abortController);

      let aiContext: AIAssistantState['context'] = defaultAIAssistantState.context;
      setAIContext((prev) => {
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
      setMessages((prevMessages) => {
        updatedMessages = clearMessages
          ? [...contextMessages, { role: 'user', content: userPrompt, internalContext: false }]
          : [...prevMessages, ...contextMessages, { role: 'user', content: userPrompt, internalContext: false }];
        return updatedMessages;
      });

      setPrompt('');

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
          setMessages,
          signal: abortController.signal,
        });
      } catch (error) {
        console.error(error);
      }

      setAbortController(undefined);
      setLoading(false);
    },
    [
      getCodeCellContext,
      getCursorSelectionContext,
      handleAIRequestToAPI,
      model,
      quadraticContext,
      setAIContext,
      setAbortController,
      setLoading,
      setMessages,
      setPrompt,
      setShowAIAssistant,
    ]
  );

  return submitPrompt;
}
