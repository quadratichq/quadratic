import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { updateCustomer } from '../../stripe/stripe';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams/:uuid.PATCH.request'],
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid.PATCH.response']>) {
  const {
    body: { name },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { permissions },
    team: { stripeCustomerId },
  } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team.');
  }

  // Update Customer name in Stripe
  if (stripeCustomerId) {
    await updateCustomer(stripeCustomerId, name);
  }

  // Update the team name
  const newTeam = await dbClient.team.update({
    where: {
      uuid,
    },
    data: {
      name,
    },
  });
  return res.status(200).json({ name: newTeam.name });
}
