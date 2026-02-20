import { loadingAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { aiAssistantLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { atom, useRecoilState, useRecoilValue } from 'recoil';

/**
 * This is a bit hacky, but it's the best way to track no. of messages left.
 *
 * At the highest level, this works by fetching the usage data once and then
 * storing it in recoil. Then we manually decrement it whenever the user submits
 * a message in the analyst or the assistant. (So we track it on the client.)
 *
 * Using the current usage endpoint doesn't work because it's not real-time.
 * When the user submits a message and we call the usage endpoint, it won't say
 * their count has gone down by one because the AI prompt is still running.
 *
 * Long-term probably the best way to handle this is have the prompt endpoint
 * stream the result as well as the usage data.
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
  const aiAnalyastLoading = useAtomValue(loadingAtom);
  const prevAiAnalyastLoading = useRef(aiAnalyastLoading);

  // Initial data load
  useEffect(() => {
    if (loadState === 'idle' && messagesLeft === null) {
      setLoadState('loading');

      apiClient.teams.billing
        .aiUsage(teamUuid)
        .then((data) => {
          if (typeof data.billingLimit == 'number' && typeof data.currentPeriodUsage === 'number') {
            setMessagesLeft(Math.max(data.billingLimit - data.currentPeriodUsage, 0));
            setLoadState('loaded');
          } else {
            throw new Error(`Unexpected data from the API: ${JSON.stringify(data)}`);
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
      setMessagesLeft(Math.max(messagesLeft - 1, 0));
    }
    prevAiAnalyastLoading.current = aiAnalyastLoading;
  }, [aiAnalyastLoading, messagesLeft, setMessagesLeft]);

  // AI assistant goes into loading state
  useEffect(() => {
    if (messagesLeft !== null && prevAiAssistantLoading.current === false && aiAssistantLoading === true) {
      setMessagesLeft(Math.max(messagesLeft - 1, 0));
    }
    prevAiAssistantLoading.current = aiAssistantLoading;
  }, [aiAssistantLoading, messagesLeft, setMessagesLeft]);

  return messagesLeft;
};
