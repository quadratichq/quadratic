import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
} from '@/app/atoms/aiAssistantAtom';
import { editorInteractionStateShowAIAssistantAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Coordinate } from '@/app/gridGL/types/size';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIContextMessages } from '@/app/ui/menus/AIAssistant/useAIContextMessages';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const setAbortController = useSetRecoilState(aiAssistantAbortControllerAtom);
  const setLoading = useSetRecoilState(aiAssistantLoadingAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);
  const setPrompt = useSetRecoilState(aiAssistantPromptAtom);
  const [model] = useAIAssistantModel();
  const handleAIRequestToAPI = useAIRequestToAPI();
  const setShowAIAssistant = useSetRecoilState(editorInteractionStateShowAIAssistantAtom);
  const { getCodeContext } = useAIContextMessages();

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

      const abortController = new AbortController();
      setAbortController(abortController);

      let updatedMessages: (UserMessage | AIMessage)[] = [];
      setMessages((prevMessages) => {
        updatedMessages = clearMessages
          ? [{ role: 'user', content: userPrompt }]
          : [...prevMessages, { role: 'user', content: userPrompt }];
        return updatedMessages;
      });
      setPrompt('');

      const { quadraticContext, aiContextReassertion } = await getCodeContext({
        sheetId,
        pos,
      });

      const messagesToSend: PromptMessage[] = [
        {
          role: 'user',
          content: quadraticContext,
        },
        {
          role: 'assistant',
          content: aiContextReassertion,
        },
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
      setAbortController,
      setLoading,
      setMessages,
      setPrompt,
      setShowAIAssistant,
    ]
  );

  return submitPrompt;
}
