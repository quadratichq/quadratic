import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { BillingAIUsageLimitExceeded, BillingAIUsageMonthlyForUser } from '../../billing/AIUsageHelpers';
import { BILLING_AI_USAGE_LIMIT } from '../../env-vars';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat/billing.GET.response']>) {
  const { user } = req;

  // If the billing limit is not set, we don't need to check if the user has exceeded it
  if (!BILLING_AI_USAGE_LIMIT) {
    return res.status(200).json({ exceededBillingLimit: false });
  }

  // Get the user's monthly AI usage
  const usage = await BillingAIUsageMonthlyForUser(user.id);

  // Check if the user has exceeded the billing limit
  const exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

  return res.status(200).json({ exceededBillingLimit });
}
