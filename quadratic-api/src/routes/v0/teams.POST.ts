import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { createTeam } from '../../utils/teams';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams.POST.response']>) {
  const {
    body: { name },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const select = {
    uuid: true,
    name: true,
  };

  const team = await createTeam(name, userId, select);

  return res.status(201).json({ uuid: team.uuid, name: team.name });
}
