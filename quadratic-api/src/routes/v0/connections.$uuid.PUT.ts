import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { encryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/connections/:uuid.PUT.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.PUT.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: newConnection,
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    team: {
      userMakingRequest: { permissions },
    },
  } = await getConnection({ uuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to update this connection');
  }

  const { name, typeDetails } = newConnection;
  const updatedConnection = await dbClient.connection.update({
    where: { uuid },
    data: {
      name,
      updatedDate: new Date(),
      typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(typeDetails))),
    },
  });

  return res.status(200).json({
    name: updatedConnection.name,
    uuid: updatedConnection.uuid,
    createdDate: updatedConnection.createdDate.toISOString(),
    updatedDate: updatedConnection.updatedDate.toISOString(),
    type: updatedConnection.type,
    typeDetails,
  });
}
