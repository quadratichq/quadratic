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
import { ResponseError } from '../../types/Response';

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

async function handler(
  req: RequestWithOptionalUser,
  res: Response<ApiTypes['/v0/files/:uuid.GET.response'] | ResponseError>
) {
  const userId = req.user?.id;
  const {
    file: { id, thumbnail, uuid, name, createdDate, updatedDate, publicLinkAccess, ownerUserId, ownerTeam },
    userMakingRequest: { filePermissions, fileRole, teamRole, teamPermissions },
  } = await getFile({ uuid: req.params.uuid, userId });

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

  // Privacy of the file as it relates to the user making the request.
  // `undefined` means it was shared _somehow_, e.g. direct invite or public link,
  // but the user doesn't have access to the file's team
  let fileTeamPrivacy: ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['fileTeamPrivacy'] = undefined;
  if (ownerUserId === userId) {
    fileTeamPrivacy = 'PRIVATE_TO_ME';
  } else if (ownerUserId !== null && teamRole) {
    fileTeamPrivacy = 'PRIVATE_TO_SOMEONE_ELSE';
  } else if (ownerUserId === null && teamRole) {
    fileTeamPrivacy = 'PUBLIC_TO_TEAM';
  }

  const data = {
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
      ownerUserId: ownerUserId ? ownerUserId : undefined,
    },
    // TODO: (team-schema) these should be guaranteed after shipping the new schema
    // @ts-expect-error
    team: { uuid: ownerTeam.uuid, name: ownerTeam.name },
    userMakingRequest: {
      id: userId,
      filePermissions,
      fileRole,
      fileTeamPrivacy,
      teamRole,
      teamPermissions,
    },
  };
  return res.status(200).json(data);
}
