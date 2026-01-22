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
    dataUuid: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/data/:dataUuid.PATCH.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid, dataUuid },
    body,
  } = parseRequest(req, schema);

  const {
    team: { id: teamId },
    userMakingRequest: { permissions, role },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, "You don't have access to this team");
  }

  // Get the data asset
  const dataAsset = await dbClient.dataAsset.findFirst({
    where: {
      uuid: dataUuid,
      ownerTeamId: teamId,
      deleted: false,
    },
    select: {
      id: true,
      ownerUserId: true,
      creatorUserId: true,
    },
  });

  if (!dataAsset) {
    throw new ApiError(404, 'Data asset not found');
  }

  // Check edit permission:
  // - Personal data: only owner can edit
  // - Team data: owner/editor roles or creator can edit
  const canEdit =
    dataAsset.ownerUserId === userId ||
    dataAsset.creatorUserId === userId ||
    (dataAsset.ownerUserId === null && (role === 'OWNER' || role === 'EDITOR'));

  if (!canEdit) {
    throw new ApiError(403, "You don't have permission to edit this data asset");
  }

  // Update the data asset
  const updated = await dbClient.dataAsset.update({
    where: {
      id: dataAsset.id,
    },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      updatedDate: new Date(),
    },
    select: {
      uuid: true,
      name: true,
    },
  });

  return res.status(200).json({
    dataAsset: updated,
  });
}
