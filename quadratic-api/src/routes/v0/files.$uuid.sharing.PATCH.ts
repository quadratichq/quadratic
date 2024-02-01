import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
const { FILE_EDIT } = FilePermissionSchema.enum;

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

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/sharing.PATCH.response']>) {
  const {
    body: { publicLinkAccess },
    user: { id: userId },
    params: { uuid },
  } = req as RequestWithUser;
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // Make sure they can edit the file sharing permissions
  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'Permission denied');
  }

  // Then edit!
  const newFile = await dbClient.file.update({
    where: { uuid },
    data: { publicLinkAccess },
  });

  return res.status(200).json({ publicLinkAccess: newFile.publicLinkAccess });
}
