import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user/ai-languages.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/ai-languages.PATCH.response']>) {
  const {
    body: { aiLanguages },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const updatedUser = await dbClient.user.update({
    where: { id: userId },
    data: { aiLanguages },
  });

  return res.status(200).json({
    aiLanguages: updatedUser.aiLanguages as ApiTypes['/v0/user/ai-languages.PATCH.response']['aiLanguages'],
  });
}
