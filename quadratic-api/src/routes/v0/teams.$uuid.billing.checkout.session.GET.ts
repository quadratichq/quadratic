import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import {
  cancelIncompleteSubscriptions,
  createCheckoutSession,
  createCustomer,
  getBusinessPriceId,
  getProPriceId,
  upgradeSubscriptionPlan,
} from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { getIsOnPaidPlan } from '../../utils/billing';
import logger from '../../utils/logger';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    'redirect-success': z.string().url(),
    'redirect-cancel': z.string().url(),
    plan: z.enum(['pro', 'business']).optional().default('pro'),
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
    query: { 'redirect-success': redirectSuccess, 'redirect-cancel': redirectCancel, plan },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res
      .status(403)
      .json({ error: { message: 'User does not have permission to access billing for this team.' } });
  }

  const isOnPaidPlan = await getIsOnPaidPlan(team);

  // Handle plan upgrades for existing subscriptions
  if (isOnPaidPlan) {
    // Check if they're trying to upgrade from Pro to Business
    // If planType is null, assume PRO (legacy teams that subscribed before planType was added)
    const currentPlanType = team.planType ?? 'PRO';

    if (plan === 'business' && currentPlanType === 'PRO') {
      // Upgrade from Pro to Business
      try {
        const businessPriceId = await getBusinessPriceId();

        logger.info('Upgrading subscription from Pro to Business', {
          teamUuid: uuid,
          teamId: team.id,
        });

        await upgradeSubscriptionPlan(team, businessPriceId, 'business');

        // Redirect to success URL after upgrade
        // Use URL/URLSearchParams to properly append the subscription parameter
        const successUrl = new URL(redirectSuccess);
        successUrl.searchParams.set('subscription', 'upgraded');
        const data: ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] = {
          url: successUrl.toString(),
        };
        return res.status(200).json(data);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error upgrading subscription plan', {
          error: errorMessage,
          teamUuid: uuid,
          plan,
        });
        return res.status(500).json({
          error: {
            message: 'Failed to upgrade subscription plan. Please try again later.',
          },
        });
      }
    } else if (plan === 'pro' && currentPlanType === 'BUSINESS') {
      // Downgrading from Business to Pro should go through billing portal
      return res.status(400).json({
        error: { message: 'Please use the billing portal to downgrade your plan.' },
      });
    } else if (plan === currentPlanType?.toLowerCase()) {
      // Already on the requested plan
      return res.status(400).json({
        error: { message: `Team is already on the ${plan} plan.` },
      });
    } else {
      // Other cases - already has an active subscription
      return res.status(400).json({ error: { message: 'Team already has an active subscription.' } });
    }
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

  // Get the price ID for the selected plan
  let priceId: string;
  if (plan === 'business') {
    try {
      priceId = await getBusinessPriceId();
    } catch (error) {
      // Business plan price doesn't exist in Stripe yet
      return res.status(503).json({
        error: {
          message: 'Business plan is not yet available. Please try upgrading to Pro plan instead.',
        },
      });
    }
  } else {
    priceId = await getProPriceId();
  }

  logger.info('Creating checkout session', {
    teamUuid: uuid,
    plan,
    priceId,
  });

  try {
    const session = await createCheckoutSession(uuid, priceId, redirectSuccess, redirectCancel, plan);

    if (!session.url) {
      return res.status(500).json({ error: { message: 'Failed to create checkout session' } });
    }

    const data: ApiTypes['/v0/teams/:uuid/billing/checkout/session.GET.response'] = { url: session.url };
    return res.status(200).json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating checkout session', {
      error: errorMessage,
      teamUuid: uuid,
      plan,
      priceId,
    });
    return res.status(500).json({
      error: {
        message: 'Failed to create checkout session. Please try again later.',
      },
    });
  }
}
