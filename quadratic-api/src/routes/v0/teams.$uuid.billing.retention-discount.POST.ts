import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { stripe } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getTeamRetentionDiscountEligibility } from '../../utils/teams';

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
  req: Request,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/retention-discount.POST.response']>
) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Can the user do this?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    throw new ApiError(403, 'User does not have permission to access billing for this team.');
  }

  // Make sure team is eligible (will throw if not)
  const retentionDiscount = await getTeamRetentionDiscountEligibility(team);
  if (!retentionDiscount.isEligible) {
    throw new ApiError(400, 'Team is not eligible for retention discount.');
  }

  try {
    // Create a 50% off coupon for the next month
    const coupon = await stripe.coupons.create({
      percent_off: 50,
      duration: 'once',
      // FYI: 40 char max
      name: 'Thanks for staying! 50% discount applied',
    });

    // Apply the coupon to the subscription
    await stripe.subscriptions.update(retentionDiscount.stripeSubscriptionId, {
      discounts: [
        {
          coupon: coupon.id,
        },
      ],
    });

    // Store in our system that they've used the coupon
    await dbClient.team.update({
      where: { id: team.id },
      data: {
        stripeSubscriptionRetentionCouponId: coupon.id,
      },
    });

    return res.status(200).json({
      message: 'Coupon applied successfully',
    });
  } catch (error) {
    console.log('Failed to apply coupon', error);
    throw new ApiError(500, 'Failed to apply coupon');
  }
}
