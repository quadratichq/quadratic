import type { Response } from 'express';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.GET.response']>) {
  const {
    user: { eduStatus },
  } = req;

  return res.status(200).send({ eduStatus: eduStatus === null ? undefined : eduStatus });
}
