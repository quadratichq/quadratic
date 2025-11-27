import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import {
  BillingAIUsageForCurrentMonth,
  BillingAIUsageLimitExceeded,
  BillingAIUsageMonthlyForUserInTeam,
  getBonusPromptsRemaining,
} from '../../billing/AIUsageHelpers';
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

  // Check if the user is member of this team and team is on a paid plan
  if (userTeamRole) {
    const isOnPaidPlan = await getIsOnPaidPlan(team);
    if (isOnPaidPlan) {
      return res.status(200).json({ exceededBillingLimit: false });
    }
  }

  // if user is not member of this team or team is not on a paid plan, check if the user has exceeded the free usage limit

  // Get usage
  const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
  let exceededBillingLimit = false;
  const exceededBy = BillingAIUsageLimitExceeded(usage);

  const bonusRemaining = (await getBonusPromptsRemaining(userId)) ?? 0;

  // include bonus prompts in the calculation
  if (exceededBy > 0) {
    exceededBillingLimit = exceededBy > bonusRemaining;
  }
  const currentPeriodUsage = BillingAIUsageForCurrentMonth(usage);

  const data = {
    exceededBillingLimit,
    billingLimit: BILLING_AI_USAGE_LIMIT + bonusRemaining,
    currentPeriodUsage,
  };
  return res.status(200).json(data);
}
