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
        checkpointId: z.string(),
      }),
    })
  ),
  validateOptionalAccessToken,
  userOptionalMiddleware,
  handler,
];

async function handler(
  req: Request,
  res: Response<ApiTypes['/v0/files/:uuid/checkpoints/:checkpointId.GET.response']>
) {
  const {
    user,
    params: { uuid, checkpointId },
  } = req as RequestWithOptionalUser;
  const userId = user?.id;

  // Ensures the file exists and the user has access to it
  await getFile({ uuid, userId });

  // FWIW: if you have access to the file, you have access to the checkpoints

  const checkpoint = await dbClient.fileCheckpoint.findFirstOrThrow({
    where: {
      id: Number(checkpointId),
    },
  });

  const dataUrl = await getFileUrl(checkpoint.s3Key);

  return res.status(200).json({
    id: checkpoint.id,
    dataUrl,
    timestamp: checkpoint.timestamp.toISOString(),
    version: checkpoint.version,
    sequenceNumber: checkpoint.sequenceNumber,
  });
}
