import type { Response } from 'express';
import dbClient from 'quadratic-api/src/dbClient';
import { getConnection } from 'quadratic-api/src/middleware/getConnection';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import { parseRequest } from 'quadratic-api/src/middleware/validateRequestSchema';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import { ApiError } from 'quadratic-api/src/utils/ApiError';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';

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
