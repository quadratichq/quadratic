import type { Response } from 'express';
import dbClient from 'quadratic-api/src/dbClient';
import { getConnection } from 'quadratic-api/src/middleware/getConnection';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import { parseRequest } from 'quadratic-api/src/middleware/validateRequestSchema';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import { ApiError } from 'quadratic-api/src/utils/ApiError';
import { encryptFromEnv } from 'quadratic-api/src/utils/crypto';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';

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
