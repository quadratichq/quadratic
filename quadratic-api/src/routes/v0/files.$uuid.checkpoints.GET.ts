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
    file: { id, name },
    // userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // TODO: permissions - anyone with access to this file can see checkpoints?

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
    name,
    checkpoints: checkpointsWithDataUrls.map(({ timestamp, version, dataUrl, id }) => ({
      id,
      dataUrl,
      timestamp: timestamp.toISOString(),
      version,
    })),
  });
}
