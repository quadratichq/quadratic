import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { generatePresignedUrl } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithOptionalUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';

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

async function handler(req: RequestWithOptionalUser, res: Response) {
  const {
    file: { id, thumbnail, uuid, name, created_date, updated_date, publicLinkAccess },
    user,
  } = await getFile({ uuid: req.params.uuid, userId: req.user?.id });

  const thumbnailSignedUrl = thumbnail ? await generatePresignedUrl(thumbnail) : null;
  const permissions = getFilePermissions({ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess });

  // Get the most recent checkpoint for the file
  const checkpoint = await dbClient.fileCheckpoint.findFirst({
    where: {
      fileId: id,
    },
    orderBy: {
      sequenceNumber: 'desc',
    },
  });
  if (!checkpoint) {
    return res.status(500).json({ error: { message: 'No Checkpoints exist for this file' } });
  }
  const lastCheckpointDataUrl = await generatePresignedUrl(checkpoint.s3Key);

  const data: ApiTypes['/v0/files/:uuid.GET.response'] = {
    file: {
      uuid,
      name,
      created_date: created_date.toISOString(),
      updated_date: updated_date.toISOString(),
      publicLinkAccess,
      lastCheckpointSequenceNumber: checkpoint?.sequenceNumber,
      lastCheckpointVersion: checkpoint?.version,
      lastCheckpointDataUrl,
      thumbnail: thumbnailSignedUrl,
    },
    user: {
      id: user?.id,
      permissions,
      role: user?.role,
    },
  };
  return res.status(200).json(data);
}
