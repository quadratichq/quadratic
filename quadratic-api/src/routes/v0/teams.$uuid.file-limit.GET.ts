import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { hasReachedFileLimit } from '../../utils/billing';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    private: z.enum(['true', 'false']).transform((val) => val === 'true'),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/file-limit.GET.response']>) {
  const {
    params: { uuid },
    query: { private: isPrivate },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const { team } = await getTeam({ uuid, userId });
  const hasReachedLimit = await hasReachedFileLimit(team, userId, isPrivate);

  return res.status(200).json({ hasReachedLimit });
}
