import { apiClient } from '@/shared/api/apiClient';
import { Avatar } from '@/shared/components/Avatar';
import { WarningIcon } from '@/shared/components/Icons';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/shadcn/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useMemo, useRef, useState } from 'react';

type UserUsage = ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response']['users'][0];

export function TeamAIUsage() {
  const { teamData } = useTeamData();
  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;
  const userMakingRequest = activeTeam?.userMakingRequest;
  const users = activeTeam?.users;
  const billing = activeTeam?.billing;

  const isOwner = useMemo(() => teamPermissions?.includes('TEAM_MANAGE') ?? false, [teamPermissions]);

  const [userUsageData, setUserUsageData] = useState<
    ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response'] | null
  >(null);
  const [allowOveragePayments, setAllowOveragePayments] = useState(false);
  const [monthlyAiAllowance, setMonthlyAiAllowance] = useState<number | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const lastFetchedUuidRef = useRef<string | null>(null);

  useEffect(() => {
    // Fetch if we have a team uuid and haven't already fetched for this uuid
    if (team?.uuid && team.uuid !== lastFetchedUuidRef.current) {
      lastFetchedUuidRef.current = team.uuid;
      setIsLoadingUsage(true);

      // Fetch both user usage data and team AI usage (for allowOveragePayments and monthlyAiAllowance)
      // Owners can fetch all users, non-owners can fetch their own data
      Promise.all([apiClient.teams.billing.aiUsageUsers(team.uuid), apiClient.teams.billing.aiUsage(team.uuid)])
        .then(([usageData, aiUsageData]) => {
          setUserUsageData(usageData);
          setAllowOveragePayments(aiUsageData.allowOveragePayments ?? false);
          setMonthlyAiAllowance(aiUsageData.monthlyAiAllowance ?? null);
        })
        .catch((error) => {
          console.error('[TeamAIUsage] Failed to fetch usage data:', error);
          // Reset ref on error so we can retry
          lastFetchedUuidRef.current = null;
        })
        .finally(() => {
          setIsLoadingUsage(false);
        });
    }
  }, [team?.uuid]);

  // If not owner, show only their own usage
  const loggedInUser = useMemo(
    () => users?.find((u) => u.id === userMakingRequest?.id),
    [users, userMakingRequest?.id]
  );
  const loggedInUserUsage = useMemo(() => {
    if (!userMakingRequest?.id || !userUsageData) return null;
    return userUsageData.users.find((u) => u.userId === userMakingRequest.id);
  }, [userMakingRequest?.id, userUsageData]);

  // Check if any user is on the Business plan
  const isBusinessPlan = useMemo(() => {
    return userUsageData?.users.some((u) => u.planType === 'BUSINESS') ?? false;
  }, [userUsageData]);

  // Check if logged-in user is on Business plan
  const isLoggedInUserBusiness = useMemo(() => {
    return loggedInUserUsage?.planType === 'BUSINESS';
  }, [loggedInUserUsage]);

  // Format included usage display for a user
  const formatIncludedUsage = (usage?: UserUsage): string => {
    if (isLoadingUsage) return '...';
    if (!usage) return '—';

    if (usage.planType === 'FREE') {
      // FREE plan: show per-user messages
      if (usage.currentPeriodUsage !== null && usage.billingLimit !== null) {
        return `${usage.currentPeriodUsage} / ${usage.billingLimit} messages`;
      }
      return '—';
    } else {
      // Pro/Business: show current cost / allowance (use team-level allowance)
      const currentCost = usage.currentMonthAiCost ?? 0;
      const allowance = monthlyAiAllowance ?? 0;
      // Cap current cost at allowance for included usage display
      const includedUsage = Math.min(currentCost, allowance);
      return `$${includedUsage.toFixed(2)} / $${allowance.toFixed(2)}`;
    }
  };

  // Check if user has hit their included usage limit (and has no on-demand available)
  const hasHitLimit = (usage?: UserUsage): boolean => {
    if (!usage) return false;

    if (usage.planType === 'FREE') {
      // FREE plan: check per-user message limit
      if (usage.currentPeriodUsage !== null && usage.billingLimit !== null) {
        return usage.currentPeriodUsage >= usage.billingLimit;
      }
      return false;
    } else {
      // Pro/Business: only show limit when over allowance and on-demand is not available
      const currentCost = usage.currentMonthAiCost ?? 0;
      const allowance = monthlyAiAllowance ?? 0;
      const overAllowance = currentCost >= allowance && allowance > 0;
      if (allowOveragePayments) return false;
      return overAllowance;
    }
  };

  // Format on-demand usage for Business plan users
  const formatOnDemandUsage = (usage?: UserUsage): string => {
    if (isLoadingUsage) return '...';
    if (!usage) return '—';

    if (usage.planType !== 'BUSINESS') return '—';

    const currentCost = usage.currentMonthAiCost ?? 0;
    const allowance = monthlyAiAllowance ?? 0;
    const onDemandUsage = Math.max(0, currentCost - allowance);

    // If on-demand is disabled and they haven't spent any money, show N/A
    if (!allowOveragePayments && onDemandUsage === 0) {
      return 'N/A';
    }

    const budgetLimit = usage.userMonthlyBudgetLimit;

    if (budgetLimit !== null) {
      return `$${onDemandUsage.toFixed(2)} / $${budgetLimit.toFixed(2)}`;
    }
    return `$${onDemandUsage.toFixed(2)}`;
  };

  if (!team || !userMakingRequest || !users || !billing) {
    return null;
  }

  // If owner, show all team members' usage in a table
  if (isOwner) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Team AI monthly usage</h4>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 w-12"></TableHead>
                <TableHead className="h-9">Name</TableHead>
                <TableHead className="h-9 w-20">Role</TableHead>
                <TableHead className="h-9">Included usage</TableHead>
                {isBusinessPlan && <TableHead className="h-9">On-demand usage</TableHead>}
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
                    {isBusinessPlan && <TableCell className="py-2">{formatOnDemandUsage(usage)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!loggedInUser) {
    return null;
  }

  // Non-owner view: show only logged-in user's usage in a table with same format as owner view
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Your AI monthly usage</h4>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 w-12"></TableHead>
              <TableHead className="h-9">Name</TableHead>
              <TableHead className="h-9">Included usage</TableHead>
              {isLoggedInUserBusiness && <TableHead className="h-9">On-demand usage</TableHead>}
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
              {isLoggedInUserBusiness && (
                <TableCell className="py-2">{formatOnDemandUsage(loggedInUserUsage ?? undefined)}</TableCell>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
