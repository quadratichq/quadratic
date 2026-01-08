import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getTeamConnection } from '../../middleware/getTeamConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getSyncedConnectionLogs } from '../../utils/connections';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
  params: z.object({ uuid: z.string().uuid(), connectionUuid: z.string().uuid() }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/connections/:connectionUuid/log.GET.response']>
) {
  const {
    user: { id: userId },
  } = req;

  const {
    params: { uuid: teamUuid, connectionUuid },
    query: { limit, page },
  } = parseRequest(req, schema);

  const {
    connection,
    team: {
      userMakingRequest: { permissions: teamPermissions },
    },
  } = await getTeamConnection({ connectionUuid, userId, teamUuid });

  const logs = await getSyncedConnectionLogs(connectionUuid, limit, page);

  // Do you have permission?
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection');
  }

  return res.status(200).json(logs);
}
