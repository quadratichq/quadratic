import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { updateCustomer } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan } from '../../utils/billing';
import { parseAndValidateClientDataKv } from '../../utils/teams';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams/:uuid.PATCH.request'],
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid.PATCH.response']>) {
  const {
    body: { name, clientDataKv, settings },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { permissions },
    team,
    team: { clientDataKv: existingClientDataKv, name: existingName, stripeCustomerId },
  } = await getTeam({ uuid, userId });

  // Can they make the edits they're trying to make?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team.');
  }
  if (settings && !permissions.includes('TEAM_MANAGE')) {
    throw new ApiError(403, 'User does not have permission to edit this team’s settings.');
  }

  // You can't change privacy settings without a paid plan
  if (settings && 'analyticsAi' in settings) {
    const isOnPaidPlan = await getIsOnPaidPlan(team);
    if (!isOnPaidPlan) {
      throw new ApiError(403, 'Upgrade to plan to disable analytics.');
    }
  }

  // Validate existing data in the db
  const validatedExistingClientDataKv = parseAndValidateClientDataKv(existingClientDataKv);

  // Update the team with supplied data
  const newTeam = await dbClient.team.update({
    where: {
      uuid,
    },
    data: {
      ...(name ? { name } : {}),
      ...(clientDataKv ? { clientDataKv: { ...validatedExistingClientDataKv, ...clientDataKv } } : {}),
      ...(settings
        ? {
            ...(settings.analyticsAi !== undefined ? { settingAnalyticsAi: settings.analyticsAi } : {}),
            ...(settings.showConnectionDemo !== undefined
              ? { settingShowConnectionDemo: settings.showConnectionDemo }
              : {}),
          }
        : {}),
    },
  });

  // Update Stripe Customer if the name has changed
  if (name && name !== existingName) {
    if (stripeCustomerId) {
      await updateCustomer(stripeCustomerId, name);
    }
  }

  // Return the new data
  const newClientDataKv = parseAndValidateClientDataKv(newTeam.clientDataKv);

  return res.status(200).json({
    name: newTeam.name,
    clientDataKv: newClientDataKv,
    settings: {
      analyticsAi: newTeam.settingAnalyticsAi,
      showConnectionDemo: newTeam.settingShowConnectionDemo,
    },
  });
}
