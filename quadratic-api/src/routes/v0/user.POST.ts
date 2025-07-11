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
import { setUserClientDataKv } from '../../utils/userClientData';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user.POST.response']>) {
  const {
    body: { onboardingResponses, clientDataKv },
  } = parseRequest(req, schema);
  const userId = req.user.id;

  if (onboardingResponses) {
    await dbClient.user.update({
      where: { id: userId },
      data: { onboardingResponses },
    });
    return res.status(200).json({ message: 'Onboarding responses saved' });
  }

  if (clientDataKv) {
    try {
      await setUserClientDataKv(userId, clientDataKv);
    } catch {
      return res.status(500).json({ message: 'Client KV data corrupted ' });
    }
    return res.status(200).json({ message: 'Client data saved' });
  }

  throw new ApiError(400, 'No data provided');
}
