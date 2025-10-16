import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { aiAssistantLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useEffect, useRef, useState } from 'react';
import { atom, useRecoilState, useRecoilValue } from 'recoil';

/**
 * A few notes, because this is a bit hacky.
 *
 * At the highest level, the way this works is we fetch the usage data once and
 * store it in recoil then we manually  decrement it whenever the user submits
 * a message.
 *
 * ...TODO: finish this
 *
 */

const messagesLeftAtom = atom<number | null>({
  key: 'useAIUsageMessagesLeftAtom',
  default: null,
});

export const useAIMessagesLeft = () => {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const [messagesLeft, setMessagesLeft] = useRecoilState(messagesLeftAtom);
  const [loadState, setLoadState] = useState<'idle' | 'loaded' | 'loading' | 'error'>('idle');
  const aiAssistantLoading = useRecoilValue(aiAssistantLoadingAtom);
  const prevAiAssistantLoading = useRef(aiAssistantLoading);
  const aiAnalyastLoading = useRecoilValue(aiAnalystLoadingAtom);
  const prevAiAnalyastLoading = useRef(aiAnalyastLoading);

  // Initial data load
  useEffect(() => {
    if (loadState === 'idle' && messagesLeft === null) {
      setLoadState('loading');

      apiClient.teams.billing
        .aiUsage(teamUuid)
        .then((data) => {
          if (data.billingLimit && data.currentPeriodUsage) {
            setMessagesLeft(data.billingLimit - data.currentPeriodUsage);
            setLoadState('loaded');
          } else {
            throw new Error('Unexpected data from the API.');
          }
        })
        .catch((err) => {
          console.error('Failed to fetch AI usage:', err);
          setMessagesLeft(null);
          setLoadState('error');
        });
    }
  }, [teamUuid, messagesLeft, loadState, setMessagesLeft]);

  // AI analyst goes into loading state
  useEffect(() => {
    if (messagesLeft !== null && prevAiAnalyastLoading.current === false && aiAnalyastLoading === true) {
      setMessagesLeft(messagesLeft - 1);
    }
    prevAiAnalyastLoading.current = aiAnalyastLoading;
  }, [aiAnalyastLoading, messagesLeft, setMessagesLeft]);

  // AI assistant goes into loading state
  useEffect(() => {
    if (messagesLeft !== null && prevAiAssistantLoading.current === false && aiAssistantLoading === true) {
      setMessagesLeft(messagesLeft - 1);
    }
    prevAiAssistantLoading.current = aiAssistantLoading;
  }, [aiAssistantLoading, messagesLeft, setMessagesLeft]);

  return messagesLeft;
};
