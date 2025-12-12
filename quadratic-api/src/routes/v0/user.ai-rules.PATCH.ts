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
  body: ApiSchemas['/v0/user/ai-rules.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/ai-rules.PATCH.response']>) {
  const {
    body: { aiRules },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const updatedUser = await dbClient.user.update({
    where: { id: userId },
    data: { aiRules },
  });

  return res.status(200).json({
    aiRules: updatedUser.aiRules ?? null,
  });
}
