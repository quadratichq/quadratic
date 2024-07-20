import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { decryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    connection,
    team: {
      userMakingRequest: { permissions: teamPermissions },
    },
  } = await getConnection({ uuid, userId });

  // Do you have permission?
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection');
  }

  const typeDetails = JSON.parse(decryptFromEnv(connection.typeDetails.toString()));

  return res.status(200).json({
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    typeDetails,
  });
}
