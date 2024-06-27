import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  query: z.object({
    'team-uuid': z.string().uuid(),
    'include-details': z
      .string()
      .refine((value) => value === 'true')
      .transform((value) => value === 'true'),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    query: { 'team-uuid': teamUuid, 'include-details': includeDetails },
  } = parseRequest(req, schema);
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
      updatedDate: 'desc',
    },
  });

  // Pick out the data we want to return
  const data = connections.map(({ uuid, name, type, createdDate, updatedDate, typeDetails }) => ({
    uuid,
    name,
    type,
    createdDate: createdDate.toISOString(),
    updatedDate: updatedDate.toISOString(),
    ...(includeDetails ? { typeDetails } : {}),
  }));

  return res.status(200).json(data);
}
