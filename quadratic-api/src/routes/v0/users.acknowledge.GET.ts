import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/users.acknowledge.GET.response']>) {
  return res.status(200).json({ message: 'acknowledged' });
}
