import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import { ApiError } from '../../utils/ApiError';

export default [handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/embeds/:uuid.GET.response']>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);

  const embed = await dbClient.embed.findUnique({
    where: { uuid },
    include: {
      file: {
        include: {
          ownerTeam: true,
        },
      },
    },
  });

  if (!embed) {
    throw new ApiError(404, 'Embed not found');
  }

  const { file } = embed;

  if (file.deleted) {
    throw new ApiError(410, 'File has been deleted');
  }

  if (file.publicLinkAccess === 'NOT_SHARED') {
    throw new ApiError(403, 'This file is not publicly accessible');
  }

  const checkpoint = await dbClient.fileCheckpoint.findFirst({
    where: { fileId: file.id },
    orderBy: { sequenceNumber: 'desc' },
  });

  if (!checkpoint) {
    throw new ApiError(500, 'No checkpoints exist for this file');
  }

  const lastCheckpointDataUrl = await getFileUrl(checkpoint.s3Key);

  const data: ApiTypes['/v0/embeds/:uuid.GET.response'] = {
    file: {
      lastCheckpointSequenceNumber: checkpoint.sequenceNumber,
      lastCheckpointVersion: checkpoint.version,
      lastCheckpointDataUrl,
    },
    team: {
      settings: {
        analyticsAi: file.ownerTeam.settingAnalyticsAi,
      },
    },
    userMakingRequest: {
      filePermissions: ['FILE_VIEW', 'FILE_EDIT'],
    },
  };

  return res.status(200).json(data);
}
