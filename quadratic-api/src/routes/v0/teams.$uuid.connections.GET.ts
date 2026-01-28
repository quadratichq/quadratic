import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { getTeamConnectionsList } from '../../middleware/getTeamConnectionsList';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/connections.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid },
  } = parseRequest(req, schema);

  const {
    team: { id: teamId, settingShowConnectionDemo },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'You don’t have access to this team');
  }

  // Get all connections in the team
  const connections = await dbClient.connection.findMany({
    where: {
      archived: null,
      teamId,
    },
    include: {
      SyncedConnection: {
        select: {
          percentCompleted: true,
          updatedDate: true,
          SyncedConnectionLog: {
            select: { status: true, error: true },
            orderBy: { createdDate: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      createdDate: 'desc',
    },
  });

  // Pick out the data we want to return
  const data = getTeamConnectionsList({ dbConnections: connections, settingShowConnectionDemo });

  return res.status(200).json(data);
}
