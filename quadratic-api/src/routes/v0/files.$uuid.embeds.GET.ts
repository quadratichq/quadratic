import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/embeds.GET.response']>) {
  const {
    params: { uuid: fileUuid },
  } = parseRequest(req, schema);

  // Verify user has access to this file
  const { file } = await getFile({ uuid: fileUuid, userId: req.user.id });

  const embeds = await dbClient.embed.findMany({
    where: { fileId: file.id },
    orderBy: { createdDate: 'desc' },
  });

  return res.status(200).json(
    embeds.map((embed) => ({
      uuid: embed.uuid,
      createdDate: embed.createdDate.toISOString(),
    }))
  );
}
