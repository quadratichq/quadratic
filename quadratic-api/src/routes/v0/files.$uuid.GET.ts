import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { generatePresignedUrl } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithOptionalUser } from '../../types/Request';

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
    file: { id, thumbnail, uuid, name, createdDate, updatedDate, publicLinkAccess, ownerTeam },
    userMakingRequest: { filePermissions, isFileOwner, fileRole },
  } = await getFile({ uuid: req.params.uuid, userId: req.user?.id });

  const thumbnailSignedUrl = thumbnail ? await generatePresignedUrl(thumbnail) : null;

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
      createdDate: createdDate.toISOString(),
      updatedDate: updatedDate.toISOString(),
      publicLinkAccess,
      lastCheckpointSequenceNumber: checkpoint?.sequenceNumber,
      lastCheckpointVersion: checkpoint?.version,
      lastCheckpointDataUrl,
      thumbnail: thumbnailSignedUrl,
    },
    team: ownerTeam ? { uuid: ownerTeam.uuid, name: ownerTeam.name } : undefined,
    userMakingRequest: {
      filePermissions,
      isFileOwner,
      fileRole,
    },
  };
  return res.status(200).json(data);
}
