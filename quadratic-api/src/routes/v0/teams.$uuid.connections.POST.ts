import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { encryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/team/:uuid/connections.POST.request'],
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections.POST.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: connection,
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You don’t have access to this team');
  }

  // Ok create the connection
  const { name, type, typeDetails } = connection;
  const result = await dbClient.connection.create({
    data: {
      name,
      teamId,
      type,
      typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(typeDetails))),
    },
  });

  // Return its identifier
  return res.status(201).json({ uuid: result.uuid });
}
