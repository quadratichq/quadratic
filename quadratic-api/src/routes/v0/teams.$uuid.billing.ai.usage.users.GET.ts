import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { BillingAIUsageForCurrentMonth, BillingAIUsageMonthlyForUsersInTeam } from '../../billing/AIUsageHelpers';
import {
  getCurrentMonthAiCostsByUser,
  getMonthlyAiAllowancePerUser,
  getPlanType,
  getUserBudgetLimitsForTeam,
  isFreePlan,
} from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { BILLING_AI_USAGE_LIMIT } from '../../env-vars';
import { getTeam } from '../../middleware/getTeam';
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

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/ai/usage/users.GET.response']>
) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });

  // Check if user has permission to view team members
  if (!userMakingRequest.permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'User does not have permission to view team members');
  }

  const isOnPaidPlan = await getIsOnPaidPlan(team);
  const isFree = isFreePlan(team);
  const planType = getPlanType(team);
  const monthlyAiAllowancePerUser = getMonthlyAiAllowancePerUser(team);

  // Get all users in the team
  const dbUsers = await dbClient.userTeamRole.findMany({
    where: {
      teamId: team.id,
    },
    select: {
      userId: true,
    },
  });

  const userIds = dbUsers.map((u) => u.userId);

  if (isFree) {
    if (!isOnPaidPlan) {
      const usageByUser = await BillingAIUsageMonthlyForUsersInTeam(userIds, team.id);
      const billingLimit = BILLING_AI_USAGE_LIMIT ?? 0;

      return res.status(200).json({
        users: userIds.map((targetUserId) => {
          const usage = usageByUser.get(targetUserId) ?? [];
          const currentPeriodUsage = BillingAIUsageForCurrentMonth(usage) ?? 0;
          return {
            userId: targetUserId,
            planType: 'FREE' as const,
            currentPeriodUsage,
            billingLimit,
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            userMonthlyBudgetLimit: null,
          };
        }),
      });
    } else {
      return res.status(200).json({
        users: userIds.map((targetUserId) => ({
          userId: targetUserId,
          planType: 'FREE' as const,
          currentPeriodUsage: null,
          billingLimit: null,
          currentMonthAiCost: null,
          monthlyAiAllowance: null,
          userMonthlyBudgetLimit: null,
        })),
      });
    }
  }

  const [costsByUser, budgetLimitsByUser] = await Promise.all([
    getCurrentMonthAiCostsByUser(team.id),
    getUserBudgetLimitsForTeam(team.id),
  ]);

  return res.status(200).json({
    users: userIds.map((targetUserId) => ({
      userId: targetUserId,
      planType: planType as 'PRO' | 'BUSINESS',
      currentPeriodUsage: null,
      billingLimit: null,
      currentMonthAiCost: costsByUser.get(targetUserId) ?? 0,
      monthlyAiAllowance: monthlyAiAllowancePerUser,
      userMonthlyBudgetLimit: budgetLimitsByUser.get(targetUserId) ?? null,
    })),
  });
}
