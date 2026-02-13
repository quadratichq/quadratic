import type { Team } from '@prisma/client';
import dbClient from '../dbClient';
import type { DecryptedTeam } from '../utils/teams';

// PlanType enum - will be available after Prisma client regeneration
export enum PlanType {
  FREE = 'FREE',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
}

/**
 * Get the plan type for a team.
 * If planType is set on the team, use that.
 * Otherwise, infer from subscription status:
 * - ACTIVE subscription = PRO (default, can be upgraded to BUSINESS)
 * - No subscription = FREE
 */
export const getPlanType = async (team: Team | DecryptedTeam): Promise<PlanType> => {
  const teamWithPlan = team as Team & { planType?: PlanType | null };
  if (teamWithPlan.planType) {
    return teamWithPlan.planType;
  }

  // Infer from subscription status
  if (team.stripeSubscriptionStatus === 'ACTIVE') {
    // Default to PRO for existing active subscriptions
    // This will be updated when they upgrade to BUSINESS
    return PlanType.PRO;
  }

  return PlanType.FREE;
};

/**
 * Check if team is on Business plan
 */
export const isBusinessPlan = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const planType = await getPlanType(team);
  return planType === PlanType.BUSINESS;
};

/**
 * Check if team is on Pro plan
 */
export const isProPlan = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const planType = await getPlanType(team);
  return planType === PlanType.PRO;
};

/**
 * Check if team is on Free plan
 */
export const isFreePlan = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const planType = await getPlanType(team);
  return planType === PlanType.FREE;
};

/**
 * Get the monthly AI allowance per user for a team.
 * - FREE: 0 (uses message limit instead)
 * - PRO: $20/user/month
 * - BUSINESS: $40/user/month
 */
export const getMonthlyAiAllowancePerUser = async (team: Team | DecryptedTeam): Promise<number> => {
  const teamWithAllowance = team as Team & { monthlyAiAllowancePerUser?: number | null };
  // If explicitly set on team, use that
  if (
    teamWithAllowance.monthlyAiAllowancePerUser !== null &&
    teamWithAllowance.monthlyAiAllowancePerUser !== undefined
  ) {
    return teamWithAllowance.monthlyAiAllowancePerUser;
  }

  // Otherwise calculate based on plan type
  const planType = await getPlanType(team);
  switch (planType) {
    case PlanType.FREE:
      return 0;
    case PlanType.PRO:
      return 0.5; // 20
    case PlanType.BUSINESS:
      return 0.5; // 40
    default:
      return 0;
  }
};

/**
 * Calculate the total monthly AI allowance for a team (allowance per user * number of users)
 */
export const getTeamMonthlyAiAllowance = async (team: Team | DecryptedTeam): Promise<number> => {
  const allowancePerUser = await getMonthlyAiAllowancePerUser(team);
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
 * Get the current month's AI cost for a team.
 * Sums all AICost records for the current calendar month.
 */
export const getCurrentMonthAiCostForTeam = async (teamId: number): Promise<number> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const result = await (dbClient as any).aICost.aggregate({
    where: {
      teamId,
      createdDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    _sum: {
      cost: true,
    },
  });

  return result._sum.cost ?? 0;
};

/**
 * Get the current month's AI cost for a specific user in a team.
 * Sums all AICost records for the current calendar month.
 */
export const getCurrentMonthAiCostForUser = async (teamId: number, userId: number): Promise<number> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const result = await (dbClient as any).aICost.aggregate({
    where: {
      teamId,
      userId,
      createdDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    _sum: {
      cost: true,
    },
  });

  return result._sum.cost ?? 0;
};

/**
 * Check if a user has exceeded their monthly AI allowance.
 * For FREE plan, this always returns false (uses message limit instead).
 */
export const hasExceededAllowance = async (team: Team | DecryptedTeam, userId: number): Promise<boolean> => {
  const planType = await getPlanType(team);
  if (planType === PlanType.FREE) {
    return false; // Free plan uses message limit, not allowance
  }

  const allowancePerUser = await getMonthlyAiAllowancePerUser(team);
  if (allowancePerUser === 0) {
    return false;
  }

  const currentCost = await getCurrentMonthAiCostForUser(team.id, userId);
  return currentCost >= allowancePerUser;
};

/**
 * Check if a team has exceeded its monthly AI allowance.
 */
export const hasTeamExceededAllowance = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const planType = await getPlanType(team);
  if (planType === PlanType.FREE) {
    return false; // Free plan uses message limit, not allowance
  }

  const teamAllowance = await getTeamMonthlyAiAllowance(team);
  if (teamAllowance === 0) {
    return false;
  }

  const currentCost = await getCurrentMonthAiCostForTeam(team.id);
  return currentCost >= teamAllowance;
};

/**
 * Get user's monthly budget limit for a team.
 * Returns null if no limit is set.
 */
export const getUserBudgetLimit = async (teamId: number, userId: number): Promise<{ limit: number } | null> => {
  const budgetLimit = await (dbClient as any).userBudgetLimit.findUnique({
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
 * Check if a user has exceeded their monthly budget limit.
 * Returns false if no budget limit is set.
 * Budgets automatically reset on the 1st of each month since costs are filtered by calendar month.
 */
export const hasExceededUserBudget = async (teamId: number, userId: number): Promise<boolean> => {
  const budgetLimit = await getUserBudgetLimit(teamId, userId);
  if (!budgetLimit) {
    return false; // No budget limit set
  }

  // Costs are already filtered by current calendar month, so just compare
  const currentCost = await getCurrentMonthAiCostForUser(teamId, userId);
  return currentCost >= budgetLimit.limit;
};

/**
 * Get the current month's AI overage cost for a team (cost beyond included allowance).
 * Returns max(0, total cost − team monthly allowance).
 */
export const getCurrentMonthOverageCostForTeam = async (team: Team | DecryptedTeam): Promise<number> => {
  const totalCost = await getCurrentMonthAiCostForTeam(team.id);
  const allowance = await getTeamMonthlyAiAllowance(team);
  return Math.max(0, totalCost - allowance);
};

/**
 * Check if a team has exceeded its monthly budget limit.
 * The limit applies to overage only (cost beyond included allowance).
 * Returns false if no budget limit is set.
 */
export const hasExceededTeamBudget = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const teamWithBudget = team as Team & {
    teamMonthlyBudgetLimit?: number | null;
  };

  if (!teamWithBudget.teamMonthlyBudgetLimit) {
    return false; // No budget limit set
  }

  const overageCost = await getCurrentMonthOverageCostForTeam(team);
  return overageCost >= teamWithBudget.teamMonthlyBudgetLimit;
};

/**
 * Check if a user can make an AI request based on allowance, budget, and overage settings.
 * Returns { allowed: boolean, reason?: string }
 */
export const canMakeAiRequest = async (
  team: Team | DecryptedTeam,
  userId: number
): Promise<{ allowed: boolean; reason?: string }> => {
  const planType = await getPlanType(team);

  // Free plan: use existing message limit check (handled elsewhere)
  if (planType === PlanType.FREE) {
    return { allowed: true };
  }

  // Check user allowance
  const exceededUserAllowance = await hasExceededAllowance(team, userId);
  if (exceededUserAllowance) {
    const teamWithOverage = team as Team & { allowOveragePayments?: boolean };
    // Check if overage is allowed
    if (planType === PlanType.BUSINESS && teamWithOverage.allowOveragePayments) {
      // Check budget limits instead
      const exceededUserBudget = await hasExceededUserBudget(team.id, userId);
      const exceededTeamBudget = await hasExceededTeamBudget(team);

      if (exceededUserBudget) {
        return {
          allowed: false,
          reason: 'User monthly budget limit exceeded',
        };
      }

      if (exceededTeamBudget) {
        return {
          allowed: false,
          reason: 'Team monthly budget limit exceeded',
        };
      }

      // Overage allowed and within budget
      return { allowed: true };
    }

    // No overage allowed or not Business plan
    return {
      allowed: false,
      reason: 'Monthly AI allowance exceeded',
    };
  }

  // Within allowance, check budget limits (if set)
  if (planType === PlanType.BUSINESS) {
    const exceededUserBudget = await hasExceededUserBudget(team.id, userId);
    if (exceededUserBudget) {
      return {
        allowed: false,
        reason: 'User monthly budget limit exceeded',
      };
    }

    const exceededTeamBudget = await hasExceededTeamBudget(team);
    if (exceededTeamBudget) {
      return {
        allowed: false,
        reason: 'Team monthly budget limit exceeded',
      };
    }
  }

  return { allowed: true };
};
