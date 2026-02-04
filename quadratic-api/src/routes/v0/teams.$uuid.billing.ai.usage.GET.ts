import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import {
  BillingAIUsageForCurrentMonth,
  BillingAIUsageLimitExceeded,
  BillingAIUsageMonthlyForUserInTeam,
} from '../../billing/AIUsageHelpers';
import {
  getCurrentMonthAiCostForTeam,
  getCurrentMonthAiCostForUser,
  getMonthlyAiAllowancePerUser,
  getTeamMonthlyAiAllowance,
  getUserBudgetLimit,
  hasExceededTeamBudget,
  isFreePlan,
} from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { BILLING_AI_USAGE_LIMIT } from '../../env-vars';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan } from '../../utils/billing';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/billing/ai/usage.GET.response']>) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;

  // If the billing limit is not set, we don't need to check if the user has exceeded it
  if (!BILLING_AI_USAGE_LIMIT) {
    return res.status(200).json({ exceededBillingLimit: false });
  }

  // Lookup the team
  const team = await dbClient.team.findUnique({
    where: {
      uuid,
    },
  });
  if (team === null) {
    throw new ApiError(404, 'Team not found');
  }

  // Get the user's role in this team
  const userTeamRole = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
  });

  const isOnPaidPlan = await getIsOnPaidPlan(team);
  const isFree = await isFreePlan(team);

  // Get usage information based on plan type
  if (isFree) {
    // Free plan: use message limit
    if (!userTeamRole || !isOnPaidPlan) {
      const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
      const exceededBillingLimit = BillingAIUsageLimitExceeded(usage);
      const currentPeriodUsage = BillingAIUsageForCurrentMonth(usage);

      return res.status(200).json({
        exceededBillingLimit,
        billingLimit: BILLING_AI_USAGE_LIMIT,
        currentPeriodUsage,
        planType: 'FREE',
        currentMonthAiCost: null,
        monthlyAiAllowance: null,
        remainingAllowance: null,
        teamMonthlyBudgetLimit: null,
        userMonthlyBudgetLimit: null,
        allowOveragePayments: false,
      });
    }
  }

  // Pro/Business plan: use cost-based limits
  const currentMonthAiCost = await getCurrentMonthAiCostForUser(team.id, userId);
  const monthlyAiAllowancePerUser = await getMonthlyAiAllowancePerUser(team);
  const remainingAllowance = Math.max(0, monthlyAiAllowancePerUser - currentMonthAiCost);

  // Get budget limits
  const userBudgetLimit = await getUserBudgetLimit(team.id, userId);
  const teamWithBudget = team as typeof team & { 
    teamMonthlyBudgetLimit?: number | null;
    allowOveragePayments?: boolean;
    planType?: string | null;
  };
  const teamMonthlyBudgetLimit = teamWithBudget.teamMonthlyBudgetLimit;
  const teamCurrentMonthCost = await getCurrentMonthAiCostForTeam(team.id);
  const teamExceededBudget = await hasExceededTeamBudget(team);

  // Check if exceeded allowance
  const exceededAllowance = currentMonthAiCost >= monthlyAiAllowancePerUser;
  const exceededBillingLimit = exceededAllowance && !teamWithBudget.allowOveragePayments;

  // If overage is allowed, check budget limits instead
  let finalExceededBillingLimit = exceededBillingLimit;
  if (exceededAllowance && teamWithBudget.allowOveragePayments) {
    // Check user budget (costs are already filtered by calendar month)
    if (userBudgetLimit) {
      finalExceededBillingLimit = currentMonthAiCost >= userBudgetLimit.limit;
    }
    // Check team budget
    if (!finalExceededBillingLimit && teamMonthlyBudgetLimit) {
      finalExceededBillingLimit = teamExceededBudget;
    }
  }

  const data = {
    exceededBillingLimit: finalExceededBillingLimit,
    billingLimit: isFree ? BILLING_AI_USAGE_LIMIT : null,
    currentPeriodUsage: isFree ? BillingAIUsageForCurrentMonth(await BillingAIUsageMonthlyForUserInTeam(userId, team.id)) : null,
    planType: isFree ? 'FREE' : (teamWithBudget.planType || 'PRO'),
    currentMonthAiCost,
    monthlyAiAllowance: monthlyAiAllowancePerUser,
    remainingAllowance,
    teamMonthlyBudgetLimit,
    teamCurrentMonthCost: teamMonthlyBudgetLimit ? teamCurrentMonthCost : null,
    userMonthlyBudgetLimit: userBudgetLimit?.limit ?? null,
    userCurrentMonthCost: userBudgetLimit ? currentMonthAiCost : null,
    allowOveragePayments: teamWithBudget.allowOveragePayments || false,
  };

  return res.status(200).json(data);
}
