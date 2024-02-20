import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { createCustomer } from '../../stripe/stripe';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      // TODO do we put a limit on the name length?
      body: ApiSchemas['/v0/teams.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response<ApiTypes['/v0/teams.POST.response']>) {
  const {
    body: { name, picture },
    user: { id: userId, auth0Id },
  } = req as RequestWithUser;

  const select = {
    uuid: true,
    name: true,
    picture: picture ? true : false,
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
      // TODO picture
      UserTeamRole: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
    select,
  });

  // TODO should return the same as `/teams/:uuid`
  const data: ApiTypes['/v0/teams.POST.response'] = { uuid: team.uuid, name: team.name };
  if (team.picture) {
    data.picture = team.picture;
  }
  return res.status(201).json(data);
}
