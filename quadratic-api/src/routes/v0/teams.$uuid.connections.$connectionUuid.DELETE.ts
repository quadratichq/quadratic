import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeamConnection } from '../../middleware/getTeamConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid(), connectionUuid: z.string().uuid() }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.DELETE.response']>
) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid, connectionUuid },
  } = parseRequest(req, schema);
  const {
    team: {
      userMakingRequest: { permissions },
    },
  } = await getTeamConnection({ connectionUuid, teamUuid, userId });

  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to delete this connection');
  }

  await dbClient.connection.update({
    where: { uuid: connectionUuid },
    data: { archived: new Date() },
  });

  return res.status(200).json({ message: 'Connection archived' });
}
