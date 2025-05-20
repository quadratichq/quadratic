import type { ResponseError } from '@sendgrid/mail';
import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { licenseClient } from '../../licenseClient';
import { getFile } from '../../middleware/getFile';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import type { RequestWithOptionalUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getDecryptedTeam } from '../../utils/teams';

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

  const thumbnailSignedUrl = thumbnail ? await getFileUrl(thumbnail) : null;

  // Apply SSH keys to the team if they don't already exist.
  let decryptedTeam = await getDecryptedTeam(ownerTeam);

  if (decryptedTeam.sshPublicKey === null) {
    throw new ApiError(500, 'Unable to retrieve SSH keys');
  }

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
    throw new ApiError(500, 'No Checkpoints exist for this file');
  }
  const lastCheckpointDataUrl = await getFileUrl(checkpoint.s3Key);

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

  const license = await licenseClient.check(false);

  if (license === null) {
    throw new ApiError(500, 'Unable to retrieve license');
  }

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
      ownerUserId: ownerUserId ? ownerUserId : undefined,
    },
    team: {
      uuid: ownerTeam.uuid,
      name: ownerTeam.name,
      settings: {
        analyticsAi: ownerTeam.settingAnalyticsAi,
      },
      sshPublicKey: decryptedTeam.sshPublicKey,
    },
    userMakingRequest: {
      id: userId,
      filePermissions,
      fileRole,
      fileTeamPrivacy,
      teamRole,
      teamPermissions,
    },
    license,
  };

  return res.status(200).json(data);
}
