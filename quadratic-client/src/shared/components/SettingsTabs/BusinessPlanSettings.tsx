import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function BusinessPlanSettings() {
  const { teamData } = useTeamData();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;
  const billing = activeTeam?.billing;

  const isOwner = useMemo(() => teamPermissions?.includes('TEAM_MANAGE') ?? false, [teamPermissions]);
  const isBusiness = useMemo(() => billing?.planType === 'BUSINESS', [billing?.planType]);

  // AI usage data state
  const [aiUsageData, setAiUsageData] = useState<ApiTypes['/v0/teams/:uuid/billing/ai/usage.GET.response'] | null>(
    null
  );
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const lastFetchedUuidRef = useRef<string | null>(null);

  // On-demand usage toggle state
  const [onDemandUsage, setOnDemandUsage] = useState<boolean>(false);
  const [isUpdatingOnDemand, setIsUpdatingOnDemand] = useState(false);

  // Spending limit state
  const [spendingLimit, setSpendingLimit] = useState<string>('');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Fetch AI usage data to get current settings
  useEffect(() => {
    if (team?.uuid && isBusiness && team.uuid !== lastFetchedUuidRef.current) {
      lastFetchedUuidRef.current = team.uuid;
      setIsLoadingUsage(true);
      apiClient.teams.billing
        .aiUsage(team.uuid)
        .then((data) => {
          setAiUsageData(data);
          setOnDemandUsage(data.allowOveragePayments ?? false);
          setSpendingLimit(data.teamMonthlyBudgetLimit?.toString() ?? '');
        })
        .catch((error) => {
          console.error('[BusinessPlanSettings] Failed to fetch AI usage data:', error);
          lastFetchedUuidRef.current = null;
        })
        .finally(() => {
          setIsLoadingUsage(false);
        });
    }
  }, [team?.uuid, isBusiness]);

  const handleOnDemandToggle = useCallback(
    async (checked: boolean) => {
      if (!team?.uuid) return;

      setIsUpdatingOnDemand(true);
      try {
        await apiClient.teams.billing.updateOverage(team.uuid, checked);
        setOnDemandUsage(checked);
        addGlobalSnackbar(checked ? 'On-demand usage enabled' : 'On-demand usage disabled', { severity: 'success' });
      } catch (error) {
        console.error('[BusinessPlanSettings] Failed to update on-demand usage:', error);
        addGlobalSnackbar('Failed to update on-demand usage', { severity: 'error' });
        // Revert the toggle on error
        setOnDemandUsage(!checked);
      } finally {
        setIsUpdatingOnDemand(false);
      }
    },
    [team?.uuid, addGlobalSnackbar]
  );

  const handleSpendingLimitSave = useCallback(async () => {
    if (!team?.uuid || isUpdatingLimit) return;

    setIsUpdatingLimit(true);
    try {
      const limitValue = spendingLimit.trim() === '' ? null : parseFloat(spendingLimit);

      if (limitValue !== null && (isNaN(limitValue) || limitValue <= 0)) {
        addGlobalSnackbar('Please enter a valid positive number', { severity: 'error' });
        setIsUpdatingLimit(false);
        return;
      }

      await apiClient.teams.billing.updateBudget(team.uuid, limitValue);
      // Update the cached data and input state so hasSpendingLimitChanged reflects the new saved value
      setAiUsageData((prev) => (prev ? { ...prev, teamMonthlyBudgetLimit: limitValue } : prev));
      setSpendingLimit(limitValue?.toString() ?? '');
      addGlobalSnackbar(limitValue ? 'Spending limit updated' : 'Spending limit removed', { severity: 'success' });
    } catch (error) {
      console.error('[BusinessPlanSettings] Failed to update spending limit:', error);
      addGlobalSnackbar('Failed to update spending limit', { severity: 'error' });
    } finally {
      setIsUpdatingLimit(false);
    }
  }, [team?.uuid, spendingLimit, isUpdatingLimit, addGlobalSnackbar]);

  const hasSpendingLimitChanged = useMemo(() => {
    const currentLimit = aiUsageData?.teamMonthlyBudgetLimit?.toString() ?? '';
    return spendingLimit !== currentLimit;
  }, [spendingLimit, aiUsageData?.teamMonthlyBudgetLimit]);

  // Don't render if not on Business plan
  if (!isBusiness || !team) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Business plan settings</h4>

      {/* On-demand usage */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label
                htmlFor="on-demand-usage"
                className={`text-sm font-medium ${!isOwner ? 'text-muted-foreground' : ''}`}
              >
                On-demand usage
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable users who hit their included usage limit to use additional AI.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Switch
                id="on-demand-usage"
                checked={onDemandUsage}
                onCheckedChange={handleOnDemandToggle}
                disabled={!isOwner || isLoadingUsage || isUpdatingOnDemand}
                aria-label="Toggle on-demand usage"
              />
            </div>
          </div>

          {/* Team spending limit - only show when on-demand usage is enabled */}
          {onDemandUsage && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label
                    htmlFor="spending-limit"
                    className={`text-sm font-medium ${!isOwner ? 'text-muted-foreground' : ''}`}
                  >
                    Team spending limit
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Limits how much the team can spend on overage (usage beyond the included allowance) each month.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-[140px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="spending-limit"
                      type="number"
                      min="0"
                      step="1"
                      value={spendingLimit}
                      onChange={(e) => setSpendingLimit(e.target.value)}
                      placeholder="No limit"
                      className="pl-7"
                      disabled={!isOwner || isLoadingUsage}
                    />
                  </div>
                  {isOwner && (
                    <Button
                      size="sm"
                      onClick={handleSpendingLimitSave}
                      disabled={!hasSpendingLimitChanged || isUpdatingLimit || isLoadingUsage}
                    >
                      {isUpdatingLimit ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </div>
              </div>
              {aiUsageData?.teamCurrentMonthCost !== null && aiUsageData?.teamCurrentMonthCost !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Current team overage spend this month: ${aiUsageData.teamCurrentMonthCost.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
