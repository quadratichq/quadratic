import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import dbClient from 'quadratic-api/src/dbClient';
import { getFile } from 'quadratic-api/src/middleware/getFile';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import { validateRequestSchema } from 'quadratic-api/src/middleware/validateRequestSchema';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import { ApiError } from 'quadratic-api/src/utils/ApiError';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
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

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/invites/:inviteId.DELETE.response']>) {
  const {
    params: { uuid, inviteId },
    user: { id: userId },
  } = req as RequestWithUser;
  const inviteToDeleteId = Number(inviteId);
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // User making the request can edit
  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'You do not have permission to delete this invite.');
  }

  // Ok, try deleting the invite
  try {
    await dbClient.fileInvite.delete({
      where: {
        id: inviteToDeleteId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ApiError(404, 'Invite does not exist');
    }
    throw error;
  }

  return res.status(200).json({ message: 'Invite deleted' });
}
