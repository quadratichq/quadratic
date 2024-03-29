import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { createCustomer } from '../../stripe/stripe';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams.POST.response']>) {
  const {
    body: { name },
  } = parseRequest(req, schema);
  const {
    user: { id: userId, auth0Id },
  } = req;

  const select = {
    uuid: true,
    name: true,
  };

  // Get user email from Auth0
  const auth0Record = await getUsersFromAuth0([{ id: userId, auth0Id }]);
  const auth0User = auth0Record[userId];

  // create Stripe customer
  const stripeCustomer = await createCustomer(name, auth0User.email);

  const team = await dbClient.team.create({
    data: {
      name,
      stripeCustomerId: stripeCustomer.id,
      UserTeamRole: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
    select,
  });

  return res.status(201).json({ uuid: team.uuid, name: team.name });
}
