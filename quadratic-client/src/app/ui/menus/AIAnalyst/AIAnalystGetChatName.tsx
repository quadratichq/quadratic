import { useGetChatName } from '@/app/ai/hooks/useGetChatName';
import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatNameAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { memo, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIAnalystGetChatName = memo(() => {
  const currentChat = useRecoilValue(aiAnalystCurrentChatAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  // updates chat name if it is empty
  const { getChatName } = useGetChatName();
  const setCurrentChatName = useSetRecoilState(aiAnalystCurrentChatNameAtom);
  useEffect(() => {
    // 2 = 1 user message + 1 ai message before we trigger the getChatName function
    if (!loading && !currentChat.name && currentChat.messages.length >= 2) {
      getChatName()
        .then((name) => {
          if (name) {
            setCurrentChatName(name);
          }
        })
        .catch((error) => {
          console.error('[AIAnalystGetChatName] getChatName: ', error);
        });
    }
  }, [currentChat.messages.length, currentChat.name, getChatName, loading, setCurrentChatName]);

  return null;
});
