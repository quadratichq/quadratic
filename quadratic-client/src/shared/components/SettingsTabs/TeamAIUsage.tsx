import { apiClient } from '@/shared/api/apiClient';
import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { Avatar } from '@/shared/components/Avatar';
import { WarningIcon } from '@/shared/components/Icons';
import { TeamAIUsageChart } from '@/shared/components/SettingsTabs/TeamAIUsageChart';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/shadcn/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { useAtomValue } from 'jotai';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UserUsage = ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response']['users'][0];

export function TeamAIUsage() {
  const { teamData } = useTeamData();
  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;
  const userMakingRequest = activeTeam?.userMakingRequest;
  const users = activeTeam?.users;
  const billing = activeTeam?.billing;

  const { planType: billingAtomPlanType, allowOveragePayments } = useAtomValue(teamBillingAtom);
  const isOwner = useMemo(() => teamPermissions?.includes('TEAM_MANAGE') ?? false, [teamPermissions]);
  const isBusiness = billingAtomPlanType === 'BUSINESS';

  const [userUsageData, setUserUsageData] = useState<
    ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response'] | null
  >(null);
  const [dailyUsageData, setDailyUsageData] = useState<
    ApiTypes['/v0/teams/:uuid/billing/ai/usage/daily.GET.response'] | null
  >(null);
  const [monthlyAiAllowance, setMonthlyAiAllowance] = useState<number | null>(null);
  const [billingPeriodStart, setBillingPeriodStart] = useState<string | null>(null);
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const lastFetchedUuidRef = useRef<string | null>(null);
  const lastFetchedPlanTypeRef = useRef<string | null>(null);
  const dailyFetchedRef = useRef(false);

  useEffect(() => {
    if (
      team?.uuid &&
      (team.uuid !== lastFetchedUuidRef.current || billingAtomPlanType !== lastFetchedPlanTypeRef.current)
    ) {
      lastFetchedUuidRef.current = team.uuid;
      lastFetchedPlanTypeRef.current = billingAtomPlanType;
      dailyFetchedRef.current = false;
      setIsLoadingUsage(true);

      Promise.all([apiClient.teams.billing.aiUsageUsers(team.uuid), apiClient.teams.billing.aiUsage(team.uuid)])
        .then(([usageData, aiUsageData]) => {
          setUserUsageData(usageData);
          setMonthlyAiAllowance(aiUsageData.monthlyAiAllowance ?? null);
          setBillingPeriodStart(aiUsageData.billingPeriodStart ?? null);
          setBillingPeriodEnd(aiUsageData.billingPeriodEnd ?? null);
        })
        .catch((error) => {
          console.error('[TeamAIUsage] Failed to fetch usage data:', error);
          lastFetchedUuidRef.current = null;
          lastFetchedPlanTypeRef.current = null;
        })
        .finally(() => {
          setIsLoadingUsage(false);
        });
    }
  }, [team?.uuid, billingAtomPlanType]);

  const fetchDailyData = useCallback(() => {
    if (!team?.uuid || dailyFetchedRef.current) return;
    dailyFetchedRef.current = true;
    setIsLoadingDaily(true);
    apiClient.teams.billing
      .aiUsageDaily(team.uuid)
      .then((data) => {
        setDailyUsageData(data);
      })
      .catch((error) => {
        console.error('[TeamAIUsage] Failed to fetch daily usage data:', error);
        dailyFetchedRef.current = false;
      })
      .finally(() => {
        setIsLoadingDaily(false);
      });
  }, [team?.uuid]);

  const handleChartModeChange = useCallback(
    (mode: 'daily' | 'monthly') => {
      if (mode === 'daily') {
        fetchDailyData();
      }
    },
    [fetchDailyData]
  );

  const loggedInUser = useMemo(
    () => users?.find((u) => u.id === userMakingRequest?.id),
    [users, userMakingRequest?.id]
  );
  const loggedInUserUsage = useMemo(() => {
    if (!userMakingRequest?.id || !userUsageData) return null;
    return userUsageData.users.find((u) => u.userId === userMakingRequest.id);
  }, [userMakingRequest?.id, userUsageData]);

  const formatIncludedUsage = (usage?: UserUsage): string => {
    if (isLoadingUsage) return '...';
    if (!usage) return '\u2014';

    if (billingAtomPlanType === 'FREE') {
      if (usage.currentPeriodUsage !== null && usage.billingLimit !== null) {
        return `${usage.currentPeriodUsage} / ${usage.billingLimit} messages`;
      }
      return '\u2014';
    } else {
      const currentCost = usage.currentMonthAiCost ?? 0;
      const allowance = monthlyAiAllowance ?? 0;
      const includedUsage = Math.min(currentCost, allowance);
      return `$${includedUsage.toFixed(2)} / $${allowance.toFixed(2)}`;
    }
  };

  const hasHitLimit = (usage?: UserUsage): boolean => {
    if (!usage) return false;

    if (billingAtomPlanType === 'FREE') {
      if (usage.currentPeriodUsage !== null && usage.billingLimit !== null) {
        return usage.currentPeriodUsage >= usage.billingLimit;
      }
      return false;
    } else {
      const currentCost = usage.currentMonthAiCost ?? 0;
      const allowance = monthlyAiAllowance ?? 0;
      const overAllowance = currentCost >= allowance && allowance > 0;
      if (allowOveragePayments) return false;
      return overAllowance;
    }
  };

  const formatOnDemandUsage = (usage?: UserUsage): string => {
    if (isLoadingUsage) return '...';
    if (!usage) return '\u2014';
    if (!isBusiness) return '\u2014';

    const billedOverage = usage.billedOverageCost ?? 0;

    if (!allowOveragePayments && billedOverage === 0) {
      return 'N/A';
    }

    const budgetLimit = usage.userMonthlyBudgetLimit;

    if (budgetLimit !== null) {
      return `$${billedOverage.toFixed(2)} / $${budgetLimit.toFixed(2)}`;
    }
    return `$${billedOverage.toFixed(2)}`;
  };

  const periodLabel = useMemo(() => {
    if (!billingPeriodStart || !billingPeriodEnd) return null;
    const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(billingPeriodStart)} \u2013 ${fmt(billingPeriodEnd)}`;
  }, [billingPeriodStart, billingPeriodEnd]);

  if (!team || !userMakingRequest || !users || !billing) {
    return null;
  }

  if (isOwner) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">
          Team AI usage{periodLabel && <span className="ml-1 font-normal text-muted-foreground">{periodLabel}</span>}
        </h4>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 w-12"></TableHead>
                <TableHead className="h-9">Name</TableHead>
                <TableHead className="h-9 w-20">Role</TableHead>
                <TableHead className="h-9">Included usage</TableHead>
                {isBusiness && <TableHead className="h-9">On-demand usage</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const usage = userUsageData?.users.find((u) => u.userId === user.id);
                const isLoggedInUser = userMakingRequest.id === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="w-12 py-2">
                      <Avatar src={user.picture} size="small">
                        {user.name ?? user.email}
                      </Avatar>
                    </TableCell>
                    <TableCell className="py-2">
                      {user.name ?? user.email}
                      {isLoggedInUser && <span className="ml-1 text-muted-foreground">(You)</span>}
                    </TableCell>
                    <TableCell className="py-2">
                      {user.role === 'OWNER' && (
                        <Badge variant="secondary" className="text-xs">
                          Owner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <span>{formatIncludedUsage(usage)}</span>
                        {hasHitLimit(usage) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive-secondary" className="gap-1">
                                  <WarningIcon size="sm" />
                                  Limit reached
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This user has reached their included AI usage limit</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    {isBusiness && <TableCell className="py-2">{formatOnDemandUsage(usage)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!isLoadingUsage && userUsageData && (
          <div className="rounded-lg border border-border p-4">
            <TeamAIUsageChart
              users={users}
              userUsageData={userUsageData}
              dailyUsageData={dailyUsageData}
              monthlyAiAllowance={monthlyAiAllowance}
              isBusiness={isBusiness}
              planType={billingAtomPlanType}
              isLoadingDaily={isLoadingDaily}
              onModeChange={handleChartModeChange}
            />
          </div>
        )}
      </div>
    );
  }

  if (!loggedInUser) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">
        Your AI usage{periodLabel && <span className="ml-1 font-normal text-muted-foreground">{periodLabel}</span>}
      </h4>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 w-12"></TableHead>
              <TableHead className="h-9">Name</TableHead>
              <TableHead className="h-9">Included usage</TableHead>
              {isBusiness && <TableHead className="h-9">On-demand usage</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="w-12 py-2">
                <Avatar src={loggedInUser.picture} size="small">
                  {loggedInUser.name ?? loggedInUser.email}
                </Avatar>
              </TableCell>
              <TableCell className="py-2">{loggedInUser.name ?? loggedInUser.email}</TableCell>
              <TableCell className="py-2">
                <div className="flex items-center gap-2">
                  <span>{formatIncludedUsage(loggedInUserUsage ?? undefined)}</span>
                  {hasHitLimit(loggedInUserUsage ?? undefined) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive-secondary" className="gap-1">
                            <WarningIcon size="sm" />
                            Limit reached
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You have reached your included AI usage limit</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              {isBusiness && (
                <TableCell className="py-2">{formatOnDemandUsage(loggedInUserUsage ?? undefined)}</TableCell>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {!isLoadingUsage && userUsageData && (
        <div className="rounded-lg border border-border p-4">
          <TeamAIUsageChart
            users={[loggedInUser]}
            userUsageData={userUsageData}
            dailyUsageData={dailyUsageData}
            monthlyAiAllowance={monthlyAiAllowance}
            isBusiness={isBusiness}
            planType={billingAtomPlanType}
            isLoadingDaily={isLoadingDaily}
            onModeChange={handleChartModeChange}
          />
        </div>
      )}
    </div>
  );
}
