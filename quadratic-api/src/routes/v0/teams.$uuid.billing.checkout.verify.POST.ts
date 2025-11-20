import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { stripe, updateTeamStatus } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: z.object({
    sessionId: z.string(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

/**
 * Verify a Stripe checkout session and update team billing status immediately.
 * This is faster than waiting for webhooks, allowing us to detect subscription
 * creation within seconds instead of potentially minutes.
 */
async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/checkout/verify.POST.response'] | ResponseError>
) {
  const { id: userId } = req.user;
  const {
    params: { uuid },
    body: { sessionId },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    throw new ApiError(403, 'User does not have permission to access billing for this team.');
  }

  // Verify the session belongs to this team's customer
  if (!team.stripeCustomerId) {
    throw new ApiError(400, 'Team does not have a Stripe customer.');
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Verify the session belongs to this team's customer
    if (session.customer !== team.stripeCustomerId) {
      throw new ApiError(403, 'Checkout session does not belong to this team.');
    }

    // If the session is complete and has a subscription, update the team status immediately
    if (session.status === 'complete' && session.subscription) {
      const subscription =
        typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await updateTeamStatus(
          subscription.id,
          subscription.status,
          team.stripeCustomerId,
          new Date(subscription.current_period_end * 1000)
        );

        return res.status(200).json({
          subscriptionActive: true,
          status: subscription.status,
        });
      }
    }

    // Session exists but subscription isn't active yet (or session incomplete)
    return res.status(200).json({
      subscriptionActive: false,
      sessionStatus: session.status || undefined,
    });
  } catch (error: any) {
    // If session doesn't exist or other Stripe error, return false
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(200).json({
        subscriptionActive: false,
        error: 'Session not found',
      });
    }
    throw error;
  }
}
