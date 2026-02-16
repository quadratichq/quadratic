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

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/embeds/:uuid.DELETE.response']>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);

  const embed = await dbClient.embed.findUnique({
    where: { uuid },
    include: { file: true },
  });

  if (!embed) {
    throw new ApiError(404, 'Embed not found');
  }

  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid: embed.file.uuid, userId: req.user.id });

  if (!filePermissions.includes('FILE_EDIT')) {
    throw new ApiError(403, 'You need edit permission to delete an embed link');
  }

  await dbClient.embed.delete({
    where: { id: embed.id },
  });

  return res.status(200).json({
    message: 'Embed deleted',
  });
}
