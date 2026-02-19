import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/embeds.POST.response']>) {
  const {
    params: { uuid: fileUuid },
  } = parseRequest(req, schema);

  const {
    file,
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid: fileUuid, userId: req.user.id });

  if (!filePermissions.includes('FILE_EDIT')) {
    throw new ApiError(403, 'You need edit permission to create an embed link');
  }

  const embed = await dbClient.embed.create({
    data: {
      fileId: file.id,
    },
  });

  return res.status(201).json({
    uuid: embed.uuid,
  });
}
