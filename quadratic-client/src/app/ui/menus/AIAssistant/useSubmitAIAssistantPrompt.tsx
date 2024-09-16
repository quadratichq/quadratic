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

export function useSubmitAIAssistantPrompt({ sheetId, pos }: { sheetId?: string; pos?: Coordinate }) {
  const setAbortController = useSetRecoilState(aiAssistantAbortControllerAtom);
  const setLoading = useSetRecoilState(aiAssistantLoadingAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);
  const setPrompt = useSetRecoilState(aiAssistantPromptAtom);
  const { model } = useAIAssistantModel();
  const handleAIRequestToAPI = useAIRequestToAPI();

  const setShowAIAssistant = useSetRecoilState(editorInteractionStateShowAIAssistantAtom);
  const { quadraticContext, aiContextReassertion } = useAIContextMessages({
    sheetId,
    pos,
  });

  // returns false if context is not loaded
  const submitPrompt = useCallback(
    async ({ userPrompt, clearMessages }: { userPrompt: string; clearMessages?: boolean }): Promise<boolean> => {
      if (quadraticContext === undefined || aiContextReassertion === undefined) return false;

      setShowAIAssistant(true);

      let previousLoading = false;
      setLoading((prev) => {
        previousLoading = prev;
        return true;
      });
      if (previousLoading) return false;

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
      return true;
    },
    [
      aiContextReassertion,
      handleAIRequestToAPI,
      model,
      quadraticContext,
      setAbortController,
      setLoading,
      setMessages,
      setPrompt,
      setShowAIAssistant,
    ]
  );

  return submitPrompt;
}
