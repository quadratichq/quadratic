import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { generatePresignedUrl, S3Bucket } from '../../storage/s3';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    dataUuid: z.string().uuid(),
  }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/data/:dataUuid/download.GET.response']>
) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid, dataUuid },
  } = parseRequest(req, schema);

  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission to view team?
  if (!permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'You don't have access to this team');
  }

  // Get the data asset
  const dataAsset = await dbClient.dataAsset.findFirst({
    where: {
      uuid: dataUuid,
      ownerTeamId: teamId,
      deleted: false,
    },
    select: {
      s3Key: true,
      ownerUserId: true,
    },
  });

  if (!dataAsset) {
    throw new ApiError(404, 'Data asset not found');
  }

  // Check access - if it's personal data, only the owner can access
  if (dataAsset.ownerUserId !== null && dataAsset.ownerUserId !== userId) {
    throw new ApiError(403, 'You don't have access to this data asset');
  }

  // Generate presigned download URL (7 days expiry)
  const downloadUrl = await generatePresignedUrl(dataAsset.s3Key, S3Bucket.DATA);

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return res.status(200).json({
    downloadUrl,
    expiresAt,
  });
}
