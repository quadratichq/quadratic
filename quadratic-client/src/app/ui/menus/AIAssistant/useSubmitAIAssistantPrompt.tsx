import {
  aiAssistantAbortControllerAtom,
  aiAssistantContextAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  defaultAIAssistantState,
} from '@/app/atoms/aiAssistantAtom';
import { editorInteractionStateShowAIAssistantAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { useCodeCellContextMessages } from '@/app/ui/menus/AIAssistant/useCodeCellContextMessages';
import { useQuadraticContextMessages } from '@/app/ui/menus/AIAssistant/useQuadraticContextMessages';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const setAbortController = useSetRecoilState(aiAssistantAbortControllerAtom);
  const setLoading = useSetRecoilState(aiAssistantLoadingAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);
  const setPrompt = useSetRecoilState(aiAssistantPromptAtom);
  const setContext = useSetRecoilState(aiAssistantContextAtom);
  const [model] = useAIAssistantModel();
  const handleAIRequestToAPI = useAIRequestToAPI();
  const setShowAIAssistant = useSetRecoilState(editorInteractionStateShowAIAssistantAtom);
  const { quadraticContext } = useQuadraticContextMessages();
  const { getCodeCellContext } = useCodeCellContextMessages();

  const submitPrompt = useCallback(
    async ({
      location,
      language,
      userPrompt,
      clearMessages,
    }: {
      location: CodeCell;
      language: CodeCellLanguage;
      userPrompt: string;
      clearMessages?: boolean;
    }) => {
      setShowAIAssistant(true);

      let previousLoading = false;
      setLoading((prev) => {
        previousLoading = prev;
        return true;
      });
      if (previousLoading) return;

      let aiContext = defaultAIAssistantState.context;
      setContext((prev) => {
        aiContext = { ...prev, codeCell: { location, language } };
        return aiContext;
      });

      const abortController = new AbortController();
      setAbortController(abortController);

      const { codeContext } = await getCodeCellContext({
        location,
        language,
        model,
      });

      let updatedMessages: (UserMessage | AIMessage)[] = [];
      setMessages((prevMessages) => {
        const lastContextMessage = prevMessages
          .filter((prevMessage) => prevMessage.role === 'user' && prevMessage.internalContext)
          .pop();
        const contextChanged = lastContextMessage?.content !== codeContext[0].content;
        const newContext = contextChanged ? codeContext : [];
        updatedMessages = clearMessages
          ? [...newContext, { role: 'user', content: userPrompt, internalContext: false }]
          : [...prevMessages, ...newContext, { role: 'user', content: userPrompt, internalContext: false }];
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
      handleAIRequestToAPI,
      model,
      quadraticContext,
      setAbortController,
      setContext,
      setLoading,
      setMessages,
      setPrompt,
      setShowAIAssistant,
    ]
  );

  return submitPrompt;
}
