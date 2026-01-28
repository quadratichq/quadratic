import { currentChatAtom, currentChatNameAtom, loadingAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useGetChatName } from '@/app/ai/hooks/useGetChatName';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useEffect } from 'react';

export const AIAnalystGetChatName = memo(() => {
  const currentChat = useAtomValue(currentChatAtom);
  const loading = useAtomValue(loadingAtom);

  // updates chat name if it is empty
  const { getChatName } = useGetChatName();
  const setCurrentChatName = useSetAtom(currentChatNameAtom);
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
