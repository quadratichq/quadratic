import {
  aiAssistantAbortControllerAtom,
  aiAssistantContextAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
  ContextType,
} from '@/app/atoms/aiAssistantAtom';
import { editorInteractionStateShowAIAssistantAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Coordinate } from '@/app/gridGL/types/size';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { useCodeContextMessages } from '@/app/ui/menus/AIAssistant/useCodeContextMessages';
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
  const { getCodeContext } = useCodeContextMessages();

  const submitPrompt = useCallback(
    async ({
      sheetId,
      pos,
      userPrompt,
      clearMessages,
    }: {
      sheetId: string;
      pos: Coordinate;
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

      setContext({ type: ContextType.CodeCell, sheetId, pos });

      const abortController = new AbortController();
      setAbortController(abortController);

      const { codeContext } = await getCodeContext({
        sheetId,
        pos,
        model,
      });

      let updatedMessages: (UserMessage | AIMessage)[] = [];
      setMessages((prevMessages) => {
        const lastContextMessage = prevMessages
          .filter((prevMessage) => prevMessage.role === 'user' && prevMessage.internalContext)
          .pop();
        const contextChanged = lastContextMessage?.content !== codeContext[0].content;
        const nextContext = contextChanged ? codeContext : [];
        updatedMessages = clearMessages
          ? [...nextContext, { role: 'user', content: userPrompt, internalContext: false }]
          : [...prevMessages, ...nextContext, { role: 'user', content: userPrompt, internalContext: false }];
        return updatedMessages;
      });

      setPrompt('');

      const messagesToSend: PromptMessage[] = [
        ...quadraticContext,
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
      getCodeContext,
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
