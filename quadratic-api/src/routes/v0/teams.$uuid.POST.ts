import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      body: ApiSchemas['/v0/teams/:uuid.POST.request'],
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
  const { user } = await getTeam({ uuid, userId });

  // TODO: improve this more generically when validating?
  const body = req.body as ApiTypes['/v0/teams/:uuid.POST.request'];

  // Can the user even edit this team?
  if (!user.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({ error: { message: 'User does not have permission to edit this team.' } });
  }

  // TODO: what if it's billing info?

  // Update the team
  const newTeam = await dbClient.team.update({
    where: {
      uuid,
    },
    data: body,
  });

  const data: ApiTypes['/v0/teams/:uuid.POST.response'] = { name: newTeam.name };
  if (newTeam.picture) data.picture = newTeam.picture;
  return res.status(200).json(data);
}
