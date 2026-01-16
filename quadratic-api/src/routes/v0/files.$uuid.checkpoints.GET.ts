import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/checkpoints.GET.response']>) {
  const {
    user: { id: userId },
    params: { uuid },
  } = req as RequestWithUser;

  const {
    file: {
      id,
      name,
      ownerTeam: { uuid: teamUuid },
    },
    userMakingRequest: { filePermissions, teamPermissions },
  } = await getFile({ uuid, userId });

  /**
   * Rules to access file version history:
   * - Be logged in
   * - Be a member of the team the file belongs to
   * - Have edit access to the file
   *
   * Note: this means, in theory, if a team viewer is granted edit access to a
   * file in a team (via an invite or public link), they can then access the version history.
   */
  if (!(filePermissions.includes('FILE_EDIT') && teamPermissions?.includes('TEAM_VIEW'))) {
    throw new ApiError(403, 'You do not have permission to access the version history of this file');
  }

  const checkpoints = await dbClient.fileCheckpoint.findMany({
    where: {
      fileId: id,
    },
    orderBy: {
      sequenceNumber: 'desc',
    },
    take: 500,
  });

  const checkpointsWithDataUrls = await Promise.all(
    checkpoints.map(async (v) => ({
      ...v,
      dataUrl: await getFileUrl(v.s3Key),
    }))
  );

  return res.status(200).json({
    file: { name },
    team: {
      uuid: teamUuid,
    },
    checkpoints: checkpointsWithDataUrls.map(({ timestamp, version, dataUrl, sequenceNumber }) => ({
      dataUrl,
      sequenceNumber,
      timestamp: timestamp.toISOString(),
      version,
    })),
    userMakingRequest: {
      id: userId,
      filePermissions: filePermissions,
      teamPermissions: teamPermissions,
    },
  });
}
