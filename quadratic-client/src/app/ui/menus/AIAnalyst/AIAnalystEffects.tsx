import { useGetChatName } from '@/app/ai/hooks/useGetChatName';
import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatNameAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIAnalystEffects = () => {
  const currentChat = useRecoilValue(aiAnalystCurrentChatAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const setCurrentChatName = useSetRecoilState(aiAnalystCurrentChatNameAtom);
  const { getChatName } = useGetChatName();

  // updates chat name if it is empty
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

  return null;
};
