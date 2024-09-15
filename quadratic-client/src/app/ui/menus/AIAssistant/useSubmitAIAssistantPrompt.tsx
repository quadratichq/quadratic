import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
  aiAssistantPromptAtom,
} from '@/app/atoms/aiAssistantAtom';
import { showAIAssistantAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { useAIContextMessages } from '@/app/ui/menus/AIAssistant/useAIContextMessages';
import { useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function useSubmitAIAssistantPrompt() {
  const handleAIRequestToAPI = useAIRequestToAPI();
  const setAbortController = useSetRecoilState(aiAssistantAbortControllerAtom);
  const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
  const [messages, setMessages] = useRecoilState(aiAssistantMessagesAtom);
  const [prompt, setPrompt] = useRecoilState(aiAssistantPromptAtom);
  const { quadraticContext, aiContextReassertion } = useAIContextMessages();
  const { model } = useAIAssistantModel();
  const setShowAIAssistant = useSetRecoilState(showAIAssistantAtom);
  const submitPrompt = useCallback(
    async (userPrompt?: string) => {
      setShowAIAssistant(true);
      if (loading) return;
      setLoading(true);

      const abortController = new AbortController();
      setAbortController(abortController);

      const updatedMessages: (UserMessage | AIMessage)[] =
        userPrompt !== undefined
          ? [{ role: 'user', content: userPrompt }]
          : [...messages, { role: 'user', content: prompt }];
      setMessages(updatedMessages);
      setPrompt(userPrompt === undefined ? '' : prompt);

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
      await handleAIRequestToAPI({
        model,
        messages: messagesToSend,
        setMessages,
        signal: abortController.signal,
      });

      setAbortController(undefined);
      setLoading(false);
    },
    [
      aiContextReassertion,
      handleAIRequestToAPI,
      loading,
      messages,
      model,
      prompt,
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
