import { PlanType, SubscriptionStatus, type Team } from '@prisma/client';
import dbClient from '../dbClient';
import { AI_ALLOWANCE_BUSINESS, AI_ALLOWANCE_PRO } from '../env-vars';
import type { DecryptedTeam } from '../utils/teams';

export { PlanType };

/**
 * Get the plan type for a team.
 * If planType is set on the team, use that.
 * Otherwise, infer from subscription status:
 * - ACTIVE subscription = PRO (default, can be upgraded to BUSINESS)
 * - No subscription = FREE
 */
export const getPlanType = (team: Team | DecryptedTeam): PlanType => {
  if (team.planType) {
    return team.planType;
  }

  // Infer from subscription status
  if (team.stripeSubscriptionStatus === 'ACTIVE') {
    return PlanType.PRO;
  }

  return PlanType.FREE;
};

/**
 * Check if team is on Business plan
 */
export const isBusinessPlan = (team: Team | DecryptedTeam): boolean => {
  return getPlanType(team) === PlanType.BUSINESS;
};

/**
 * Check if team is on Pro plan
 */
export const isProPlan = (team: Team | DecryptedTeam): boolean => {
  return getPlanType(team) === PlanType.PRO;
};

/**
 * Check if team is on Free plan
 */
export const isFreePlan = (team: Team | DecryptedTeam): boolean => {
  return getPlanType(team) === PlanType.FREE;
};

/**
 * Get the default monthly AI allowance per user for a plan type.
 * Does not consider any team-level overrides.
 */
export const getDefaultAllowanceForPlan = (planType: PlanType): number => {
  switch (planType) {
    case PlanType.FREE:
      return 0;
    case PlanType.PRO:
      return AI_ALLOWANCE_PRO;
    case PlanType.BUSINESS:
      return AI_ALLOWANCE_BUSINESS;
    default:
      return 0;
  }
};

/**
 * Get the monthly AI allowance per user for a team.
 * Derived from the team's plan type and env-var defaults.
 * - FREE: 0 (uses message limit instead)
 * - PRO: $20/user/month (AI_ALLOWANCE_PRO)
 * - BUSINESS: $40/user/month (AI_ALLOWANCE_BUSINESS)
 */
export const getMonthlyAiAllowancePerUser = (team: Team | DecryptedTeam): number => {
  return getDefaultAllowanceForPlan(getPlanType(team));
};

/**
 * Calculate the total monthly AI allowance for a team (allowance per user * number of users)
 */
export const getTeamMonthlyAiAllowance = async (team: Team | DecryptedTeam): Promise<number> => {
  const allowancePerUser = getMonthlyAiAllowancePerUser(team);
  if (allowancePerUser === 0) {
    return 0;
  }

  const userCount = await dbClient.userTeamRole.count({
    where: {
      teamId: team.id,
    },
  });

  return allowancePerUser * userCount;
};

/**
 * Get the billing period date range for a team.
 * Uses Stripe billing period when available, falls back to calendar month.
 */
export const getBillingPeriodDates = (team: Team | DecryptedTeam): { start: Date; end: Date } => {
  if (team.stripeCurrentPeriodStart && team.stripeCurrentPeriodEnd) {
    return { start: team.stripeCurrentPeriodStart, end: team.stripeCurrentPeriodEnd };
  }
  const now = new Date();
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
  };
};

/**
 * Get the AI cost for a team within a date range.
 */
export const getBillingPeriodAiCostForTeam = async (teamId: number, start: Date, end: Date): Promise<number> => {
  const result = await dbClient.aICost.aggregate({
    where: {
      teamId,
      createdDate: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      cost: true,
    },
  });

  return result._sum.cost ?? 0;
};

/**
 * Get the AI cost for a specific user in a team within a date range.
 */
export const getBillingPeriodAiCostForUser = async (
  teamId: number,
  userId: number,
  start: Date,
  end: Date
): Promise<number> => {
  const result = await dbClient.aICost.aggregate({
    where: {
      teamId,
      userId,
      createdDate: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      cost: true,
    },
  });

  return result._sum.cost ?? 0;
};

/**
 * Get total and overage-enabled AI costs for a team within a date range in one query.
 */
export const getBillingPeriodAiCostBreakdownForTeam = async (
  teamId: number,
  start: Date,
  end: Date
): Promise<{ totalCost: number; overageEnabledCost: number }> => {
  const results = await dbClient.aICost.groupBy({
    by: ['overageEnabled'],
    where: { teamId, createdDate: { gte: start, lte: end } },
    _sum: { cost: true },
  });
  let totalCost = 0;
  let overageEnabledCost = 0;
  for (const row of results) {
    const cost = row._sum.cost ?? 0;
    totalCost += cost;
    if (row.overageEnabled) overageEnabledCost += cost;
  }
  return { totalCost, overageEnabledCost };
};

/**
 * Get total and overage-enabled AI costs for a user in a team within a date range in one query.
 */
export const getBillingPeriodAiCostBreakdownForUser = async (
  teamId: number,
  userId: number,
  start: Date,
  end: Date
): Promise<{ totalCost: number; overageEnabledCost: number }> => {
  const results = await dbClient.aICost.groupBy({
    by: ['overageEnabled'],
    where: { teamId, userId, createdDate: { gte: start, lte: end } },
    _sum: { cost: true },
  });
  let totalCost = 0;
  let overageEnabledCost = 0;
  for (const row of results) {
    const cost = row._sum.cost ?? 0;
    totalCost += cost;
    if (row.overageEnabled) overageEnabledCost += cost;
  }
  return { totalCost, overageEnabledCost };
};

/**
 * Check if a user has exceeded their monthly AI allowance.
 * For FREE plan, this always returns false (uses message limit instead).
 */
export const hasExceededAllowance = async (team: Team | DecryptedTeam, userId: number): Promise<boolean> => {
  const planType = getPlanType(team);
  if (planType === PlanType.FREE) {
    return false;
  }

  const allowancePerUser = getMonthlyAiAllowancePerUser(team);
  if (allowancePerUser === 0) {
    return false;
  }

  const { start, end } = getBillingPeriodDates(team);
  const currentCost = await getBillingPeriodAiCostForUser(team.id, userId, start, end);
  return currentCost >= allowancePerUser;
};

/**
 * Check if a team has exceeded its monthly AI allowance.
 */
export const hasTeamExceededAllowance = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const planType = getPlanType(team);
  if (planType === PlanType.FREE) {
    return false;
  }

  const teamAllowance = await getTeamMonthlyAiAllowance(team);
  if (teamAllowance === 0) {
    return false;
  }

  const { start, end } = getBillingPeriodDates(team);
  const currentCost = await getBillingPeriodAiCostForTeam(team.id, start, end);
  return currentCost >= teamAllowance;
};

/**
 * Get user's monthly budget limit for a team.
 * Returns null if no limit is set.
 */
export const getUserBudgetLimit = async (teamId: number, userId: number): Promise<{ limit: number } | null> => {
  const budgetLimit = await dbClient.userBudgetLimit.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (!budgetLimit) {
    return null;
  }

  return {
    limit: budgetLimit.monthlyBudgetLimit,
  };
};

/**
 * Get AI costs for all users in a team within a date range, in a single query.
 * Returns a Map from userId to cost.
 */
export const getBillingPeriodAiCostsByUser = async (
  teamId: number,
  start: Date,
  end: Date
): Promise<Map<number, number>> => {
  const results = await dbClient.aICost.groupBy({
    by: ['userId'],
    where: {
      teamId,
      createdDate: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      cost: true,
    },
  });

  const costMap = new Map<number, number>();
  for (const row of results) {
    costMap.set(row.userId, row._sum.cost ?? 0);
  }
  return costMap;
};

/**
 * Get all user budget limits for a team in a single query.
 * Returns a Map from userId to their budget limit.
 */
export const getUserBudgetLimitsForTeam = async (teamId: number): Promise<Map<number, number>> => {
  const budgetLimits = await dbClient.userBudgetLimit.findMany({
    where: { teamId },
  });

  const limitMap = new Map<number, number>();
  for (const bl of budgetLimits) {
    limitMap.set(bl.userId, bl.monthlyBudgetLimit);
  }
  return limitMap;
};

/**
 * Check if a user has exceeded their monthly budget limit.
 * Budget limits cap the user's billed overage (costs with overageEnabled=true beyond allowance).
 * Returns false if no budget limit is set.
 * Budgets reset each billing period since costs are filtered by the period dates.
 */
export const hasExceededUserBudget = async (team: Team | DecryptedTeam, userId: number): Promise<boolean> => {
  const budgetLimit = await getUserBudgetLimit(team.id, userId);
  if (!budgetLimit) {
    return false;
  }

  const allowancePerUser = getMonthlyAiAllowancePerUser(team);
  const { start, end } = getBillingPeriodDates(team);
  const breakdown = await getBillingPeriodAiCostBreakdownForUser(team.id, userId, start, end);
  const totalOverage = allowancePerUser > 0 ? Math.max(0, breakdown.totalCost - allowancePerUser) : 0;
  const billedOverage = Math.min(totalOverage, breakdown.overageEnabledCost);
  return billedOverage >= budgetLimit.limit;
};

/**
 * Get the billing period's billed overage cost for a team.
 * Only counts costs from records where overageEnabled=true that exceed the team allowance.
 */
export const getBillingPeriodOverageCostForTeam = async (team: Team | DecryptedTeam): Promise<number> => {
  const { start, end } = getBillingPeriodDates(team);
  const allowance = await getTeamMonthlyAiAllowance(team);

  const results = await dbClient.aICost.groupBy({
    by: ['overageEnabled'],
    where: {
      teamId: team.id,
      createdDate: { gte: start, lte: end },
    },
    _sum: { cost: true },
  });

  let totalCost = 0;
  let overageEnabledCost = 0;
  for (const row of results) {
    const cost = row._sum.cost ?? 0;
    totalCost += cost;
    if (row.overageEnabled) {
      overageEnabledCost += cost;
    }
  }

  const totalOverage = Math.max(0, totalCost - allowance);
  return Math.min(totalOverage, overageEnabledCost);
};

/**
 * Check if a team has exceeded its monthly budget limit.
 * The limit applies to overage only (cost beyond included allowance).
 * Returns false if no budget limit is set.
 */
export const hasExceededTeamBudget = async (team: Team | DecryptedTeam): Promise<boolean> => {
  if (!team.teamMonthlyBudgetLimit) {
    return false;
  }

  const overageCost = await getBillingPeriodOverageCostForTeam(team);
  return overageCost >= team.teamMonthlyBudgetLimit;
};

/**
 * Check if a user can make an AI request based on allowance, budget, and overage settings.
 * Returns { allowed: boolean, reason?: string }
 *
 * Fetches all billing data in parallel to minimize latency, since this runs on every AI request.
 *
 * Budget semantics (both user and team budgets cap overage spend only):
 * - User budget limit: caps the user's overage spend (beyond included per-user allowance)
 * - Team budget limit: caps the team's overage spend (beyond included team allowance)
 */
export const canMakeAiRequest = async (
  team: Team | DecryptedTeam,
  userId: number
): Promise<{ allowed: boolean; reason?: string }> => {
  const planType = getPlanType(team);

  if (planType === PlanType.FREE) {
    return { allowed: true };
  }

  // Guard: if planType is non-FREE but subscription is not active (e.g., missed
  // webhook left stale planType), treat as free so the message-limit path applies.
  if (team.stripeSubscriptionStatus !== SubscriptionStatus.ACTIVE) {
    return { allowed: true };
  }

  const allowancePerUser = getMonthlyAiAllowancePerUser(team);
  const { start, end } = getBillingPeriodDates(team);

  if (planType === PlanType.PRO) {
    if (allowancePerUser === 0) {
      return { allowed: true };
    }
    const userCost = await getBillingPeriodAiCostForUser(team.id, userId, start, end);
    if (userCost >= allowancePerUser) {
      return { allowed: false, reason: 'Monthly AI allowance exceeded' };
    }
    return { allowed: true };
  }

  // Business plan: fetch all billing data in parallel
  const [userBreakdown, budgetLimit, teamBreakdown, userCount] = await Promise.all([
    getBillingPeriodAiCostBreakdownForUser(team.id, userId, start, end),
    getUserBudgetLimit(team.id, userId),
    getBillingPeriodAiCostBreakdownForTeam(team.id, start, end),
    dbClient.userTeamRole.count({ where: { teamId: team.id } }),
  ]);

  const userCost = userBreakdown.totalCost;
  const teamAllowance = allowancePerUser * userCount;
  const exceededUserAllowance = allowancePerUser > 0 && userCost >= allowancePerUser;

  // Budget checks only count billed overage (costs incurred while on-demand was enabled)
  const userTotalOverage = allowancePerUser > 0 ? Math.max(0, userCost - allowancePerUser) : 0;
  const userBilledOverage = Math.min(userTotalOverage, userBreakdown.overageEnabledCost);
  const exceededUserBudget = budgetLimit !== null && userBilledOverage >= budgetLimit.limit;

  const teamTotalOverage = teamAllowance > 0 ? Math.max(0, teamBreakdown.totalCost - teamAllowance) : 0;
  const teamBilledOverage = Math.min(teamTotalOverage, teamBreakdown.overageEnabledCost);
  const exceededTeamBudget = team.teamMonthlyBudgetLimit != null && teamBilledOverage >= team.teamMonthlyBudgetLimit;

  if (exceededUserAllowance) {
    if (team.allowOveragePayments) {
      if (exceededUserBudget) {
        return { allowed: false, reason: 'User monthly budget limit exceeded' };
      }
      if (exceededTeamBudget) {
        return { allowed: false, reason: 'Team monthly budget limit exceeded' };
      }
      return { allowed: true };
    }
    return { allowed: false, reason: 'Monthly AI allowance exceeded' };
  }

  if (exceededUserBudget) {
    return { allowed: false, reason: 'User monthly budget limit exceeded' };
  }
  if (exceededTeamBudget) {
    return { allowed: false, reason: 'Team monthly budget limit exceeded' };
  }

  return { allowed: true };
};

/**
 * Get billed overage cost per user in a team for a billing period.
 * Only includes costs from records where overageEnabled=true that exceed the per-user allowance.
 * Returns a Map from userId to their billed overage cost.
 */
export const getBilledOverageCostsByUser = async (
  teamId: number,
  start: Date,
  end: Date,
  monthlyAiAllowancePerUser: number
): Promise<Map<number, number>> => {
  const results = await dbClient.aICost.groupBy({
    by: ['userId', 'overageEnabled'],
    where: {
      teamId,
      createdDate: { gte: start, lte: end },
    },
    _sum: { cost: true },
  });

  const totalByUser = new Map<number, number>();
  const overageEnabledByUser = new Map<number, number>();

  for (const row of results) {
    const userId = row.userId;
    const cost = row._sum.cost ?? 0;
    totalByUser.set(userId, (totalByUser.get(userId) ?? 0) + cost);
    if (row.overageEnabled) {
      overageEnabledByUser.set(userId, (overageEnabledByUser.get(userId) ?? 0) + cost);
    }
  }

  const billedMap = new Map<number, number>();
  for (const [userId, totalCost] of totalByUser) {
    const overageEnabledCost = overageEnabledByUser.get(userId) ?? 0;
    if (totalCost <= monthlyAiAllowancePerUser || overageEnabledCost === 0) {
      billedMap.set(userId, 0);
      continue;
    }
    const totalOverage = Math.max(0, totalCost - monthlyAiAllowancePerUser);
    billedMap.set(userId, Math.min(totalOverage, overageEnabledCost));
  }

  return billedMap;
};

/**
 * Get daily AI costs grouped by user and day for a billing period.
 * Returns flat array of { date, userId, cost, overageEnabledCost }.
 */
export const getDailyAiCostsByUser = async (
  teamId: number,
  start: Date,
  end: Date
): Promise<Array<{ date: string; userId: number; cost: number; overageEnabledCost: number }>> => {
  const rows = await dbClient.$queryRaw<
    Array<{ day: Date; user_id: number; cost: number; overage_enabled_cost: number }>
  >`
    SELECT
      DATE_TRUNC('day', created_date) AS day,
      user_id,
      SUM(cost)::double precision AS cost,
      SUM(CASE WHEN overage_enabled THEN cost ELSE 0 END)::double precision AS overage_enabled_cost
    FROM "AICost"
    WHERE team_id = ${teamId}
      AND created_date >= ${start}
      AND created_date <= ${end}
    GROUP BY DATE_TRUNC('day', created_date), user_id
    ORDER BY day, user_id
  `;

  return rows.map((row) => ({
    date: row.day.toISOString().split('T')[0],
    userId: row.user_id,
    cost: row.cost,
    overageEnabledCost: row.overage_enabled_cost,
  }));
};
