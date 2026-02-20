import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getDailyAiMessagesByUser } from '../../billing/AIUsageHelpers';
import {
  getBillingPeriodDates,
  getDailyAiCostsByUser,
  getMonthlyAiAllowancePerUser,
  getPlanType,
  isFreePlan,
} from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

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
  res: Response<ApiTypes['/v0/teams/:uuid/billing/ai/usage/daily.GET.response']>
) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });

  if (!userMakingRequest.permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'User does not have permission to view team members');
  }

  const isFree = isFreePlan(team);
  const planType = getPlanType(team);
  const monthlyAiAllowancePerUser = getMonthlyAiAllowancePerUser(team);

  const dbUsers = await dbClient.userTeamRole.findMany({
    where: { teamId: team.id },
    select: { userId: true },
  });
  const userIds = dbUsers.map((u) => u.userId);

  if (isFree) {
    const now = new Date();
    const calStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const calEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const dailyMessages = await getDailyAiMessagesByUser(userIds, team.id);

    return res.status(200).json({
      dailyCosts: dailyMessages.map((row) => ({
        date: row.date,
        userId: row.userId,
        value: row.messageCount,
        billedOverageCost: 0,
      })),
      monthlyAiAllowance: null,
      billingPeriodStart: calStart.toISOString(),
      billingPeriodEnd: calEnd.toISOString(),
      planType: 'FREE',
    });
  }

  const { start, end } = getBillingPeriodDates(team);
  const dailyCosts = await getDailyAiCostsByUser(team.id, start, end);

  const cumulativeByUser = new Map<number, number>();

  const dailyCostsWithOverage = dailyCosts.map((row) => {
    const prevCumulative = cumulativeByUser.get(row.userId) ?? 0;
    const newCumulative = prevCumulative + row.cost;
    cumulativeByUser.set(row.userId, newCumulative);

    let billedOverageCost = 0;
    if (newCumulative > monthlyAiAllowancePerUser && row.overageEnabledCost > 0) {
      const overagePortionOfDay = Math.max(0, newCumulative - Math.max(prevCumulative, monthlyAiAllowancePerUser));
      billedOverageCost = Math.min(overagePortionOfDay, row.overageEnabledCost);
    }

    return {
      date: row.date,
      userId: row.userId,
      value: row.cost,
      billedOverageCost,
    };
  });

  return res.status(200).json({
    dailyCosts: dailyCostsWithOverage,
    monthlyAiAllowance: monthlyAiAllowancePerUser,
    billingPeriodStart: start.toISOString(),
    billingPeriodEnd: end.toISOString(),
    planType: planType || 'PRO',
  });
}
