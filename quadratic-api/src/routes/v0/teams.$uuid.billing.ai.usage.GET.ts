import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import {
  BillingAIUsageForCurrentMonth,
  BillingAIUsageLimitExceeded,
  BillingAIUsageMonthlyForUserInTeam,
  getBillingPeriodAiMessagesForTeam,
} from '../../billing/AIUsageHelpers';
import {
  canMakeAiRequest,
  getBillingPeriodAiCostForUser,
  getBillingPeriodDates,
  getMonthlyAiAllowancePerUser,
  getUserBudgetLimit,
  isFreePlan,
} from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { BILLING_AI_USAGE_LIMIT } from '../../env-vars';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan } from '../../utils/billing';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/billing/ai/usage.GET.response']>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const { id: userId } = req.user;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });
  if (!userMakingRequest.permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'User does not have permission to view AI usage for this team');
  }

  const isOnPaidPlan = await getIsOnPaidPlan(team);
  const isFree = isFreePlan(team);

  // Free plan: use message limit and return early
  if (isFree) {
    if (!BILLING_AI_USAGE_LIMIT) {
      return res.status(200).json({ exceededBillingLimit: false });
    }

    const freeUsage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
    if (!isOnPaidPlan) {
      const exceededBillingLimit = BillingAIUsageLimitExceeded(freeUsage);
      const currentPeriodUsage = BillingAIUsageForCurrentMonth(freeUsage);

      // Get team-level message usage and limit (free plan uses calendar month)
      const now = new Date();
      const calStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const calEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const teamCurrentMonthMessages = await getBillingPeriodAiMessagesForTeam(team.id, calStart, calEnd);
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
        teamCurrentMonthOverageCost: null,
        teamCurrentMonthMessages: teamCurrentMonthMessages,
        teamMessageLimit: teamMessageLimit,
        userMonthlyBudgetLimit: null,
        allowOveragePayments: false,
      });
    }
  }

  // Pro/Business plan: use cost-based limits with billing period dates
  const { start: periodStart, end: periodEnd } = getBillingPeriodDates(team);
  const currentMonthAiCost = await getBillingPeriodAiCostForUser(team.id, userId, periodStart, periodEnd);
  const monthlyAiAllowancePerUser = getMonthlyAiAllowancePerUser(team);
  const remainingAllowance = Math.max(0, monthlyAiAllowancePerUser - currentMonthAiCost);

  // Get budget limits
  const userBudgetLimit = await getUserBudgetLimit(team.id, userId);
  const teamMonthlyBudgetLimit = team.teamMonthlyBudgetLimit;
  const teamCurrentMonthOverageCost =
    team.allowOveragePayments || teamMonthlyBudgetLimit != null
      ? team.stripeOverageBilledPeriodStart?.getTime() === periodStart.getTime()
        ? team.stripeOverageBilledCents / 100
        : 0
      : null;

  // Delegate the exceeded decision to canMakeAiRequest (single source of truth)
  const { allowed } = await canMakeAiRequest(team, userId);

  const data = {
    exceededBillingLimit: !allowed,
    billingLimit: null,
    currentPeriodUsage: null,
    planType: team.planType || 'PRO',
    currentMonthAiCost,
    monthlyAiAllowance: monthlyAiAllowancePerUser,
    remainingAllowance,
    teamMonthlyBudgetLimit,
    teamCurrentMonthOverageCost: teamCurrentMonthOverageCost,
    teamCurrentMonthMessages: null,
    teamMessageLimit: null,
    userMonthlyBudgetLimit: userBudgetLimit?.limit ?? null,
    userCurrentMonthCost: userBudgetLimit ? currentMonthAiCost : null,
    allowOveragePayments: team.allowOveragePayments || false,
    billingPeriodStart: periodStart.toISOString(),
    billingPeriodEnd: periodEnd.toISOString(),
  };

  return res.status(200).json(data);
}
