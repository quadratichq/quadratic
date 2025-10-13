import { aiAnalystCurrentChatMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { aiAssistantCurrentChatMessagesCountAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export interface AIUsageData {
  exceededBillingLimit: boolean;
  billingLimit?: number;
  currentPeriodUsage?: number;
}

export const useAIUsage = () => {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const aiAnalystMessageCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const aiAssistantMessageCount = useRecoilValue(aiAssistantCurrentChatMessagesCountAtom);
  const [data, setData] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAIUsage = useCallback(async () => {
    if (!teamUuid) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.teams.billing.aiUsage(teamUuid);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch AI usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch AI usage');
    } finally {
      setLoading(false);
    }
  }, [teamUuid]);

  useEffect(() => {
    fetchAIUsage();
  }, [fetchAIUsage]);

  // Refetch usage when message counts change (new messages sent)
  useEffect(() => {
    fetchAIUsage();
  }, [aiAnalystMessageCount, aiAssistantMessageCount, fetchAIUsage]);

  const messagesRemaining =
    data?.billingLimit && data?.currentPeriodUsage !== undefined
      ? Math.max(0, data.billingLimit - data.currentPeriodUsage - 1)
      : null;

  return {
    data,
    loading,
    error,
    refetch: fetchAIUsage,
    messagesRemaining,
  };
};
