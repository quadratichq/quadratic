import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/ai-languages.GET.response']>) {
  parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { aiLanguages: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return res.status(200).json({
    aiLanguages: user.aiLanguages as ApiTypes['/v0/user/ai-languages.GET.response']['aiLanguages'],
  });
}
