import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas, UserClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
import { getUserClientDataKv } from '../../utils/userClientData';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user/client-data-kv.POST.request'],
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/user/client-data-kv.POST.response'] | ResponseError>
) {
  const { body: newClientDataKv } = parseRequest(req, schema);
  const userId = req.user.id;

  // Require at least one known key before proceeding
  if (Object.keys(newClientDataKv).length === 0) {
    return res.status(400).json({ error: { message: 'No data provided that matches the known schema' } });
  }

  // Merge the new data with the old
  const existingClientDataKv = await getUserClientDataKv(userId);
  const mergedClientDataKv = { ...existingClientDataKv, ...newClientDataKv };
  const checkMergedClientDataKv = UserClientDataKvSchema.safeParse(mergedClientDataKv);
  if (!checkMergedClientDataKv.success) {
    throw new ApiError(400, 'Client data KV corrupted', checkMergedClientDataKv.error);
  }

  const updatedUser = await dbClient.user.update({
    where: { id: userId },
    data: { clientDataKv: mergedClientDataKv },
  });

  // Ensure it worked
  const result = UserClientDataKvSchema.safeParse(updatedUser.clientDataKv);
  if (!result.success) {
    throw new ApiError(500, 'Client data KV corrupted', result.error);
  }

  // Return
  return res.status(200).json(result.data);
}
