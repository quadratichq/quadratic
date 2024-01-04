import { Request, Response } from 'express';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
      body: ApiSchemas['/v0/files/:uuid/sharing.PATCH.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    body: { publicLinkAccess },
    user: { id: userId },
    params: { uuid },
  } = req as RequestWithUser;
  const {
    user: { permissions },
  } = await getFile({ uuid, userId });

  // Make sure they can edit the file sharing permissions
  if (!permissions.includes('FILE_EDIT')) {
    throw new ApiError(403, 'Permission denied');
  }

  // Then edit!
  await dbClient.file.update({
    where: { uuid },
    data: { publicLinkAccess },
  });

  return res.status(200).json({ message: 'File updated.' });
}
