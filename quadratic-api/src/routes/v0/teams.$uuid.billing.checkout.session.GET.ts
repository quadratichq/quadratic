import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { createCheckoutSession, createCustomer, getMonthlyPriceId } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import { getIsOnPaidPlan } from '../../utils/billing';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
      query: z.object({
        redirect: z.string().url().optional(),
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
    query: { redirect },
    user: { id: userId, email },
  } = req as RequestWithUser;
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

  const monthlyPriceId = await getMonthlyPriceId();

  // If the client gave us a redirect URL, use that. Otherwise, fallback to team settings
  const returnUrl = new URL(
    typeof redirect === 'string' ? redirect : `${req.headers.origin || 'http://localhost:3000'}/teams/${uuid}/settings`
  );
  const session = await createCheckoutSession(uuid, monthlyPriceId, returnUrl);

  if (!session.url) {
    return res.status(500).json({ error: { message: 'Failed to create checkout session' } });
  }

  const data: ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] = { url: session.url };
  return res.status(200).json(data);
}
