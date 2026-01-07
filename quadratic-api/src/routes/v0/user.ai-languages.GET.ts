import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { AILanguagePreferencesSchema } from 'quadratic-shared/typesAndSchemasAI';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/ai-languages.GET.response']>) {
  const {
    user: { id: userId },
  } = req;

  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { aiLanguages: true },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return res.status(200).json({
    aiLanguages: AILanguagePreferencesSchema.parse(user.aiLanguages),
  });
}
