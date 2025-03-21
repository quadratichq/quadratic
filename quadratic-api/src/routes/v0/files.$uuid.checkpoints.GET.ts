import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import type { RequestWithOptionalUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateOptionalAccessToken,
  userOptionalMiddleware,
  handler,
];

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/checkpoints.GET.response']>) {
  const {
    user,
    params: { uuid },
  } = req as RequestWithOptionalUser;
  const userId = user?.id;

  const {
    file: { id, name },
  } = await getFile({ uuid, userId });

  // FWIW: anyone with _some_ access to this file can access the checkpoints

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
