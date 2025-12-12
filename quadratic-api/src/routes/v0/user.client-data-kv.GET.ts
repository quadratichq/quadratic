import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { getUserClientDataKv } from '../../utils/userClientData';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user/client-data-kv.GET.response']>) {
  parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const clientDataKv = await getUserClientDataKv(userId);

  return res.status(200).json({
    clientDataKv: clientDataKv ?? undefined,
  });
}
