import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import {
  BillingAIUsageForCurrentMonth,
  BillingAIUsageLimitExceeded,
  BillingAIUsageMonthlyForUserInTeam,
  getCurrentMonthAiMessagesForTeam,
} from '../../billing/AIUsageHelpers';
import {
  getCurrentMonthAiCostForUser,
  getCurrentMonthOverageCostForTeam,
  getMonthlyAiAllowancePerUser,
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
  let freeUsage: Awaited<ReturnType<typeof BillingAIUsageMonthlyForUserInTeam>> | null = null;
  if (isFree) {
    freeUsage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
    // Free plan: use message limit
    if (!userTeamRole || !isOnPaidPlan) {
      const exceededBillingLimit = BillingAIUsageLimitExceeded(freeUsage);
      const currentPeriodUsage = BillingAIUsageForCurrentMonth(freeUsage);

      // Get team-level message usage and limit
      const teamCurrentMonthMessages = await getCurrentMonthAiMessagesForTeam(team.id);
      const userCount = await dbClient.userTeamRole.count({
        where: {
          teamId: team.id,
        },
      });
      const teamMessageLimit = (BILLING_AI_USAGE_LIMIT ?? 0) * userCount;

      return res.status(200).json({
        exceededBillingLimit,
        billingLimit: BILLING_AI_USAGE_LIMIT,
        currentPeriodUsage,
        planType: 'FREE',
        currentMonthAiCost: null,
        monthlyAiAllowance: null,
        remainingAllowance: null,
        teamMonthlyBudgetLimit: null,
        teamCurrentMonthCost: null,
        teamCurrentMonthMessages: teamCurrentMonthMessages,
        teamMessageLimit: teamMessageLimit,
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
  const teamMonthlyBudgetLimit = team.teamMonthlyBudgetLimit;
  const teamCurrentMonthOverageCost =
    teamMonthlyBudgetLimit != null ? await getCurrentMonthOverageCostForTeam(team) : null;
  const teamExceededBudget = await hasExceededTeamBudget(team);

  // Check if exceeded allowance
  const exceededAllowance = currentMonthAiCost >= monthlyAiAllowancePerUser;
  const exceededBillingLimit = exceededAllowance && !team.allowOveragePayments;

  // If overage is allowed, check budget limits instead
  let finalExceededBillingLimit = exceededBillingLimit;
  if (exceededAllowance && team.allowOveragePayments) {
    // Check user budget (costs are already filtered by calendar month)
    if (userBudgetLimit) {
      finalExceededBillingLimit = currentMonthAiCost >= userBudgetLimit.limit;
    }
    // Check team budget
    if (!finalExceededBillingLimit && teamMonthlyBudgetLimit) {
      finalExceededBillingLimit = teamExceededBudget;
    }
  }

  // For FREE plan, get team-level message data
  let teamCurrentMonthMessages: number | null = null;
  let teamMessageLimit: number | null = null;
  if (isFree) {
    teamCurrentMonthMessages = await getCurrentMonthAiMessagesForTeam(team.id);
    const userCount = await dbClient.userTeamRole.count({
      where: {
        teamId: team.id,
      },
    });
    teamMessageLimit = (BILLING_AI_USAGE_LIMIT ?? 0) * userCount;
  }

  const data = {
    exceededBillingLimit: finalExceededBillingLimit,
    billingLimit: isFree ? BILLING_AI_USAGE_LIMIT : null,
    currentPeriodUsage: freeUsage ? BillingAIUsageForCurrentMonth(freeUsage) : null,
    planType: isFree ? 'FREE' : team.planType || 'PRO',
    currentMonthAiCost,
    monthlyAiAllowance: monthlyAiAllowancePerUser,
    remainingAllowance,
    teamMonthlyBudgetLimit,
    teamCurrentMonthCost: teamCurrentMonthOverageCost,
    teamCurrentMonthMessages: isFree ? teamCurrentMonthMessages : null,
    teamMessageLimit: isFree ? teamMessageLimit : null,
    userMonthlyBudgetLimit: userBudgetLimit?.limit ?? null,
    userCurrentMonthCost: userBudgetLimit ? currentMonthAiCost : null,
    allowOveragePayments: team.allowOveragePayments || false,
  };

  return res.status(200).json(data);
}
