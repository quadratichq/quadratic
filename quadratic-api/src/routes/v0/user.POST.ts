import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user.POST.response']>) {
  const {
    body: { onboardingResponses },
  } = parseRequest(req, schema);
  const userId = req.user.id;

  if (onboardingResponses) {
    await dbClient.user.update({
      where: { id: userId },
      data: { onboardingResponses },
    });
    return res.status(200).json({ message: 'Onboarding responses saved' });
  }

  throw new ApiError(400, 'No data provided');
}
