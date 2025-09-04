import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeamConnection } from '../../middleware/getTeamConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { encryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    connectionUuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.PUT.request'],
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.PUT.response']>
) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: newConnection,
    params: { uuid: teamUuid, connectionUuid },
  } = parseRequest(req, schema);
  const {
    team: {
      userMakingRequest: { permissions },
    },
  } = await getTeamConnection({ connectionUuid, teamUuid, userId });

  // Do you have permission to edit?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to update this connection');
  }

  const { name, typeDetails, semanticDescription } = newConnection;
  const updatedConnection = await dbClient.connection.update({
    where: { uuid: connectionUuid },
    data: {
      name,
      updatedDate: new Date(),
      semanticDescription,
      typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(typeDetails))),
    },
  });

  return res.status(200).json({
    name: updatedConnection.name,
    uuid: updatedConnection.uuid,
    createdDate: updatedConnection.createdDate.toISOString(),
    updatedDate: updatedConnection.updatedDate.toISOString(),
    type: updatedConnection.type,
    semanticDescription: updatedConnection.semanticDescription || undefined,
    typeDetails,
  });
}
