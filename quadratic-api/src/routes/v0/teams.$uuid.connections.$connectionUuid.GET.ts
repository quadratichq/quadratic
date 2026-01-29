import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { SyncedConnectionLatestLogStatus } from 'quadratic-shared/typesAndSchemasConnections';
import z from 'zod';
import { getTeamConnection } from '../../middleware/getTeamConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { decryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid(), connectionUuid: z.string().uuid() }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.GET.response']>
) {
  const {
    user: { id: userId },
  } = req;

  const {
    params: { uuid: teamUuid, connectionUuid },
  } = parseRequest(req, schema);

  const {
    connection,
    team: {
      userMakingRequest: { permissions: teamPermissions },
    },
    syncedConnection,
  } = await getTeamConnection({ connectionUuid, userId, teamUuid });

  // Do you have permission?
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection');
  }

  const typeDetails = JSON.parse(decryptFromEnv(Buffer.from(connection.typeDetails).toString('utf-8')));
  const latestLog = syncedConnection?.SyncedConnectionLog?.[0];

  return res.status(200).json({
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    semanticDescription: connection.semanticDescription || undefined,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    typeDetails,
    syncedConnectionPercentCompleted: syncedConnection?.percentCompleted ?? undefined,
    syncedConnectionUpdatedDate: syncedConnection?.updatedDate?.toISOString() ?? undefined,
    syncedConnectionLatestLogStatus: (latestLog?.status as SyncedConnectionLatestLogStatus) ?? undefined,
    syncedConnectionLatestLogError: latestLog?.error ?? undefined,
  });
}
