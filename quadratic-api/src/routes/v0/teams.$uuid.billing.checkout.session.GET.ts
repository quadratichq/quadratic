import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { createCheckoutSession, getMonthlyPriceId } from '../../stripe/stripe';
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
  const { userMakingRequest } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res
      .status(403)
      .json({ error: { message: 'User does not have permission to access billing for this team.' } });
  }

  const monthlyPriceId = await getMonthlyPriceId();

  const session = await createCheckoutSession(uuid, monthlyPriceId, req.headers.origin || 'http://localhost:3000');

  if (!session.url) {
    return res.status(500).json({ error: { message: 'Failed to create checkout session' } });
  }

  const data: ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] = { url: session.url };
  return res.status(200).json(data);
}
