import { SubscriptionStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import {
  BillingAIUsageForCurrentMonth,
  BillingAIUsageLimitExceeded,
  BillingAIUsageMonthlyForUser,
} from '../../billing/AIUsageHelpers';
import { BILLING_AI_USAGE_LIMIT } from '../../env-vars';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

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

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;

  // If the billing limit is not set, we don't need to check if the user has exceeded it
  if (!BILLING_AI_USAGE_LIMIT) {
    return res.status(200).json({ exceededBillingLimit: false });
  }

  // Check if the user is on a paid team
  const team = await getTeam({ uuid, userId: userId });
  if (team) {
    const isOnPaidTeam = team.team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE;
    if (isOnPaidTeam) {
      return res.status(200).json({ exceededBillingLimit: false });
    }
  }

  // Get the user's monthly AI usage
  const usage = await BillingAIUsageMonthlyForUser(userId);
  const currentPeriodUsage = BillingAIUsageForCurrentMonth(usage);

  // Check if the user has exceeded the billing limit
  const exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

  const data: ApiTypes['/v0/teams/:uuid/billing/ai/usage.GET.response'] = {
    exceededBillingLimit,
    billingLimit: BILLING_AI_USAGE_LIMIT,
    currentPeriodUsage,
  };

  return res.status(200).json(data);
}
