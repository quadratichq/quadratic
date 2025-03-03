import { useGetChatName } from '@/app/ai/hooks/useGetChatName';
import { useGetUserPromptSuggestions } from '@/app/ai/hooks/useGetUserPromptSuggestions';
import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatNameAtom,
  aiAnalystLoadingAtom,
  aiAnalystPromptSuggestionsAtom,
  aiAnalystPromptSuggestionsCountAtom,
} from '@/app/atoms/aiAnalystAtom';
import { memo, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIAnalystEffects = memo(() => {
  const currentChat = useRecoilValue(aiAnalystCurrentChatAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  // updates chat name if it is empty
  const { getChatName } = useGetChatName();
  const setCurrentChatName = useSetRecoilState(aiAnalystCurrentChatNameAtom);
  useEffect(() => {
    if (!loading && !currentChat.name && currentChat.messages.length > 0) {
      getChatName()
        .then((name) => {
          if (name) {
            setCurrentChatName(name);
          }
        })
        .catch((error) => {
          console.error('[AIAnalystEffects] getChatName: ', error);
        });
    }
  }, [currentChat.messages.length, currentChat.name, getChatName, loading, setCurrentChatName]);

  // updates user prompt suggestions if it is empty
  const { getUserPromptSuggestions } = useGetUserPromptSuggestions();
  const promptSuggestionsCount = useRecoilValue(aiAnalystPromptSuggestionsCountAtom);
  const setPromptSuggestions = useSetRecoilState(aiAnalystPromptSuggestionsAtom);
  useEffect(() => {
    if (!loading && !promptSuggestionsCount) {
      getUserPromptSuggestions()
        .then((suggestions) => {
          setPromptSuggestions(suggestions);
        })
        .catch((error) => {
          setPromptSuggestions([]);
          console.error('[AIAnalystEffects] getUserPromptSuggestions: ', error);
        });
    }
  }, [currentChat, getUserPromptSuggestions, loading, promptSuggestionsCount, setPromptSuggestions]);

  return null;
});
