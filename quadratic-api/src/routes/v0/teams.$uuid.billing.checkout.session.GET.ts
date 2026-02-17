import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { cancelIncompleteSubscriptions, createCheckoutSession, createCustomer, getMonthlyPriceId } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { getIsOnPaidPlan } from '../../utils/billing';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    'redirect-success': z.string().url(),
    'redirect-cancel': z.string().url(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] | ResponseError>
) {
  const { id: userId, email } = req.user;
  const {
    params: { uuid },
    query: { 'redirect-success': redirectSuccess, 'redirect-cancel': redirectCancel },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res
      .status(403)
      .json({ error: { message: 'User does not have permission to access billing for this team.' } });
  }

  const isOnPaidPlan = await getIsOnPaidPlan(team);
  if (isOnPaidPlan) {
    return res.status(400).json({ error: { message: 'Team already has an active subscription.' } });
  }

  // create a stripe customer if one doesn't exist
  if (!team?.stripeCustomerId) {
    // create Stripe customer
    const stripeCustomer = await createCustomer(team.name, email);
    await dbClient.team.update({
      where: { uuid },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    team.stripeCustomerId = stripeCustomer.id;
  }

  // Cancel any incomplete subscriptions from previous abandoned checkout attempts.
  // This prevents duplicate subscriptions when users retry checkout.
  await cancelIncompleteSubscriptions(team.stripeCustomerId);

  const monthlyPriceId = await getMonthlyPriceId();

  const session = await createCheckoutSession(uuid, monthlyPriceId, redirectSuccess, redirectCancel);

  if (!session.url) {
    return res.status(500).json({ error: { message: 'Failed to create checkout session' } });
  }

  const data: ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] = { url: session.url };
  return res.status(200).json(data);
}
