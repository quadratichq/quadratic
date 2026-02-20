import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { reportAndTrackOverage } from '../../billing/aiCostTracking.helper';
import { isBusinessPlan } from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { addOverageSubscriptionItem, removeOverageSubscriptionItem } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import logger from '../../utils/logger';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: z.object({
    allowOveragePayments: z.boolean(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/overage.PATCH.response'] | ResponseError>
) {
  const { id: userId } = req.user;
  const {
    params: { uuid },
    body: { allowOveragePayments },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Team editors and owners can toggle overage payments
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({ error: { message: 'You do not have permission to toggle overage payments.' } });
  }

  // Overage payments are only available for Business plan
  const isBusiness = isBusinessPlan(team);
  if (!isBusiness) {
    return res.status(400).json({
      error: { message: 'Overage payments are only available for Business plan.' },
    });
  }

  // Manage metered subscription item for overage billing
  let stripeOverageItemId = team.stripeOverageItemId;
  if (allowOveragePayments && !stripeOverageItemId && team.stripeSubscriptionId) {
    try {
      stripeOverageItemId = await addOverageSubscriptionItem(team.stripeSubscriptionId);
    } catch (error) {
      logger.error('Failed to create Stripe overage subscription item', {
        error: error instanceof Error ? error.message : String(error),
        teamUuid: uuid,
      });
      return res.status(500).json({
        error: { message: 'Failed to enable on-demand usage. Please try again later.' },
      });
    }
  } else if (!allowOveragePayments && stripeOverageItemId) {
    try {
      await removeOverageSubscriptionItem(stripeOverageItemId);
      stripeOverageItemId = null;
    } catch (error) {
      logger.error('Failed to remove Stripe overage subscription item', {
        error: error instanceof Error ? error.message : String(error),
        teamUuid: uuid,
      });
      return res.status(500).json({
        error: { message: 'Failed to disable on-demand usage. Please try again later.' },
      });
    }
  }

  const updatedTeam = await dbClient.team.update({
    where: { uuid },
    data: {
      allowOveragePayments,
      stripeOverageItemId,
      // Reset billed tracking when disabling overage
      ...(!allowOveragePayments && {
        stripeOverageBilledCents: 0,
        stripeOverageBilledPeriodStart: null,
      }),
    },
  });

  // Report any existing overage when enabling on-demand usage
  if (allowOveragePayments) {
    await reportAndTrackOverage(updatedTeam.id);
  }

  const data: ApiTypes['/v0/teams/:uuid/billing/overage.PATCH.response'] = {
    allowOveragePayments,
  };

  return res.status(200).json(data);
}
