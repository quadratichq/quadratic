import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.DELETE.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    team: {
      userMakingRequest: { permissions },
    },
  } = await getConnection({ uuid, userId });

  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to delete this connection');
  }

  await dbClient.connection.update({
    where: { uuid },
    data: { archived: new Date() },
  });

  return res.status(200).json({ message: 'Connection archived' });
}
