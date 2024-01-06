import { Request, Response } from 'express';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
        inviteId: z.coerce.number(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    params: { uuid, inviteId },
    user: { id: userId },
  } = req as RequestWithUser;
  const inviteToDelete = Number(inviteId);
  const { userMakingRequest } = await getFile({ uuid, userId });

  // User making the request can edit
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({
      error: { message: 'You do not have permission to delete this invite.' },
    });
  }

  // Ok, delete the invite
  await dbClient.fileInvite.delete({
    where: {
      id: inviteToDelete,
    },
  });
  const data: ApiTypes['/v0/files/:uuid/invites/:inviteId.DELETE.response'] = { message: 'Invite deleted' };
  return res.status(200).json(data);
}
