import type { Response } from 'express';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import { parseRequest } from 'quadratic-api/src/middleware/validateRequestSchema';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/feedback.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/feedback.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  res.status(200).json({ message: 'Feedback received' });

  console.log(userId);
  console.log(body);
}
