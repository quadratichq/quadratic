import { aiAnalystCurrentChatAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import type { JsAITransactions } from '@/app/quadratic-core-types';
import { convertAIUpdatesToChatMessage } from '@/app/ui/menus/AIAnalyst/hooks/aiTransaction';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

export const useAIUpdates = () => {
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);

  useEffect(() => {
    const handleAIUpdates = (updates: JsAITransactions) => {
      setCurrentChat((prev) => {
        // We don't need to update the AI chat if it's currently empty. (The
        // updates are only interesting if the user has already started a chat.)
        if (prev.messages.length === 0) {
          return prev;
        }
        const messages = {
          ...prev,
          messages: [...prev.messages, convertAIUpdatesToChatMessage(updates)],
        };
        console.log(messages);
        return messages;
      });
    };
    events.on('aiUpdates', handleAIUpdates);
    return () => {
      events.off('aiUpdates', handleAIUpdates);
    };
  }, [setCurrentChat]);
};
