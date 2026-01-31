import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
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

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/data.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid },
  } = parseRequest(req, schema);

  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, "You don't have access to this team");
  }

  // Get all team data assets (public to team - ownerUserId is null)
  const teamData = await dbClient.dataAsset.findMany({
    where: {
      ownerTeamId: teamId,
      ownerUserId: null,
      deleted: false,
    },
    select: {
      uuid: true,
      name: true,
      type: true,
      size: true,
      createdDate: true,
      updatedDate: true,
    },
    orderBy: {
      createdDate: 'desc',
    },
  });

  // Get all personal data assets (private to user - ownerUserId is set)
  const personalData = await dbClient.dataAsset.findMany({
    where: {
      ownerTeamId: teamId,
      ownerUserId: userId,
      deleted: false,
    },
    select: {
      uuid: true,
      name: true,
      type: true,
      size: true,
      createdDate: true,
      updatedDate: true,
    },
    orderBy: {
      createdDate: 'desc',
    },
  });

  // Format dates for response
  const formatDataAsset = (asset: typeof teamData[0]) => ({
    ...asset,
    createdDate: asset.createdDate.toISOString(),
    updatedDate: asset.updatedDate.toISOString(),
  });

  return res.status(200).json({
    data: teamData.map(formatDataAsset),
    dataPrivate: personalData.map(formatDataAsset),
  });
}

