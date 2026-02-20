import { apiClient } from '@/shared/api/apiClient';
import { setAllowOveragePayments, setTeamMonthlyBudgetLimit } from '@/shared/atom/teamBillingAtom';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseOverageSettingsOptions {
  teamUuid: string | undefined;
  enabled: boolean;
}

export function useOverageSettings({ teamUuid, enabled }: UseOverageSettingsOptions) {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const [aiUsageData, setAiUsageData] = useState<ApiTypes['/v0/teams/:uuid/billing/ai/usage.GET.response'] | null>(
    null
  );
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [onDemandUsage, setOnDemandUsage] = useState(false);
  const [isUpdatingOnDemand, setIsUpdatingOnDemand] = useState(false);
  const [spendingLimit, setSpendingLimit] = useState('');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  const lastFetchedUuidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastFetchedUuidRef.current = null;
      return;
    }
    if (!teamUuid || teamUuid === lastFetchedUuidRef.current) return;

    lastFetchedUuidRef.current = teamUuid;
    setIsLoadingUsage(true);
    apiClient.teams.billing
      .aiUsage(teamUuid)
      .then((data) => {
        setAiUsageData(data);
        setOnDemandUsage(data.allowOveragePayments ?? false);
        setSpendingLimit(data.teamMonthlyBudgetLimit?.toFixed(2) ?? '');
        setAllowOveragePayments(data.allowOveragePayments ?? false);
        setTeamMonthlyBudgetLimit(data.teamMonthlyBudgetLimit ?? null);
      })
      .catch(() => {
        lastFetchedUuidRef.current = null;
      })
      .finally(() => {
        setIsLoadingUsage(false);
      });
  }, [enabled, teamUuid]);

  const refreshUsageData = useCallback(async () => {
    if (!teamUuid) return;
    try {
      const data = await apiClient.teams.billing.aiUsage(teamUuid);
      setAiUsageData(data);
      setSpendingLimit(data.teamMonthlyBudgetLimit?.toFixed(2) ?? '');
    } catch {
      // ignored
    }
  }, [teamUuid]);

  const handleOnDemandToggle = useCallback(
    async (checked: boolean) => {
      if (!teamUuid) return;

      setIsUpdatingOnDemand(true);
      try {
        await apiClient.teams.billing.updateOverage(teamUuid, checked);
        setOnDemandUsage(checked);
        setAllowOveragePayments(checked);
        addGlobalSnackbar(checked ? 'On-demand usage enabled' : 'On-demand usage disabled', { severity: 'success' });
        if (checked) {
          await refreshUsageData();
        }
      } catch {
        addGlobalSnackbar('Failed to update on-demand usage', { severity: 'error' });
        setOnDemandUsage(!checked);
      } finally {
        setIsUpdatingOnDemand(false);
      }
    },
    [teamUuid, addGlobalSnackbar, refreshUsageData]
  );

  const handleSpendingLimitSave = useCallback(async () => {
    if (!teamUuid || isUpdatingLimit) return;

    setIsUpdatingLimit(true);
    try {
      const limitValue = spendingLimit.trim() === '' ? null : parseFloat(spendingLimit);

      if (limitValue !== null && (isNaN(limitValue) || limitValue <= 0)) {
        addGlobalSnackbar('Please enter a valid positive number', { severity: 'error' });
        setIsUpdatingLimit(false);
        return;
      }

      await apiClient.teams.billing.updateBudget(teamUuid, limitValue);
      setAiUsageData((prev) => (prev ? { ...prev, teamMonthlyBudgetLimit: limitValue } : prev));
      setSpendingLimit(limitValue?.toFixed(2) ?? '');
      setTeamMonthlyBudgetLimit(limitValue);
      addGlobalSnackbar(limitValue ? 'Spending limit updated' : 'Spending limit removed', { severity: 'success' });
      await refreshUsageData();
    } catch {
      addGlobalSnackbar('Failed to update spending limit', { severity: 'error' });
    } finally {
      setIsUpdatingLimit(false);
    }
  }, [teamUuid, isUpdatingLimit, spendingLimit, addGlobalSnackbar, refreshUsageData]);

  const hasSpendingLimitChanged = useMemo(() => {
    const currentLimit = aiUsageData?.teamMonthlyBudgetLimit?.toFixed(2) ?? '';
    return spendingLimit !== currentLimit;
  }, [spendingLimit, aiUsageData?.teamMonthlyBudgetLimit]);

  return {
    aiUsageData,
    isLoadingUsage,
    onDemandUsage,
    isUpdatingOnDemand,
    spendingLimit,
    setSpendingLimit,
    isUpdatingLimit,
    hasSpendingLimitChanged,
    handleOnDemandToggle,
    handleSpendingLimitSave,
  };
}
