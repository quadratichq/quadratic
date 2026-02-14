import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { isSyncedConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { z } from 'zod';
import { generateConnectionMemory } from '../../ai/memory/memoryService';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { encryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams/:uuid/connections.POST.request'],
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/connections.POST.response']>) {
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
  const { name, type, typeDetails, semanticDescription } = connection;
  const result = await dbClient.connection.create({
    data: {
      name,
      teamId,
      semanticDescription,
      type,
      typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(typeDetails))),
    },
  });

  // if this is a synced connection type, create a synced connection
  if (isSyncedConnectionType(type)) {
    await dbClient.syncedConnection.create({
      data: {
        connectionId: result.id,
      },
    });
  }

  // Generate AI memory for this connection (background, best-effort)
  generateConnectionMemory({
    teamId,
    connectionId: result.uuid,
    connectionName: name,
    connectionType: type,
    tables: [],
  }).catch((err) => {
    console.error('[ai-memory] Failed to generate connection memory:', err);
  });

  // Return its identifier
  return res.status(201).json({ uuid: result.uuid });
}
