import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

/**
 * TODO: remove this in a future deployment, as it is replaced by `user.acknowledge.GET`
 * and we just keep it around for the 10-20 min window of deployment.
 */
async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/acknowledge.GET.response']>) {
  return res.status(200).json({ message: 'acknowledged', userCreated: req.userCreated });
}
