import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  query: z.object({
    'team-uuid': z.string().uuid().optional(),
    'file-uuid': z.string().uuid().optional(),
  }),
});

async function handler(
  req: RequestWithUser,
  res: Response<
    | ApiTypes['/v0/connections?team-uuid.GET.response']
    | ApiTypes['/v0/connections?file-uuid.GET.response']
    | ResponseError
  >
) {
  const {
    user: { id: userId },
  } = req;
  const {
    query: { 'team-uuid': teamUuid, 'file-uuid': fileUuid },
  } = parseRequest(req, schema);

  /**
   * Connections in a team (with all details)
   */
  if (teamUuid) {
    const {
      team: { id: teamId },
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
      orderBy: {
        createdDate: 'desc',
      },
    });

    // Pick out the data we want to return
    const data = connections.map(({ uuid, name, type, createdDate, updatedDate, typeDetails }) => ({
      uuid,
      name,
      createdDate: createdDate.toISOString(),
      updatedDate: updatedDate.toISOString(),
      type,
      // @ts-expect-error will fix in david's branch
      typeDetails: removeSensitiveInfoFromTypeDetails(type, typeDetails),
    }));

    return res.status(200).json(data);
  }

  /**
   * Connections in a file (no details)
   */
  if (fileUuid) {
    const {
      file,
      userMakingRequest: { teamPermissions },
    } = await getFile({ uuid: fileUuid, userId });

    // If they don't have access to the team, return 0 connections
    if (!(file.ownerTeamId && teamPermissions && teamPermissions.includes('TEAM_EDIT'))) {
      return [];
    }

    // Get the connections for a team
    const connections = await dbClient.connection.findMany({
      where: {
        archived: null,
        teamId: file.ownerTeamId,
      },
      orderBy: {
        createdDate: 'desc',
      },
    });
    // Pick out the data we want
    const data = connections.map(({ uuid, name, type, createdDate, updatedDate }) => ({
      uuid,
      name,
      createdDate: createdDate.toISOString(),
      updatedDate: updatedDate.toISOString(),
      type,
    }));
    return res.status(200).json(data);
  }

  throw new ApiError(400, 'You must provide either a `team-uuid` or a `file-uuid` param');
}

function removeSensitiveInfoFromTypeDetails(type: string, typeDetails: string) {
  if (type === 'POSTGRES' || type === 'MYSQL') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = JSON.parse(typeDetails);
    return rest;
  }

  throw new ApiError(500, 'Unknown connection type');
}
