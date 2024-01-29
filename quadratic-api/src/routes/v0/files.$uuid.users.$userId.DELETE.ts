import { Request, Response } from 'express';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
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
        userId: z.coerce.number(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const resSuccess: ApiTypes['/v0/files/:uuid/users/:userId.DELETE.response'] = { message: 'User deleted' };
  const {
    user: { id: userMakingRequestId },
    params: { userId: userIdString },
  } = req as RequestWithUser;
  const userToDeleteId = Number(userIdString);
  const {
    file: { id: fileId },
    userMakingRequest,
  } = await getFile({ uuid: req.params.uuid, userId: userMakingRequestId });

  // User deleting themselves?
  if (userMakingRequestId === userToDeleteId) {
    // Can't delete yourself as the owner
    if (userMakingRequest.isFileOwner) {
      return res.status(403).json({
        error: { message: 'You cannot delete yourself as the file owner.' },
      });
    }

    // Delete!
    await dbClient.userFileRole.delete({
      where: {
        userId_fileId: {
          userId: userToDeleteId,
          fileId,
        },
      },
    });
    return res.status(200).json({ ...resSuccess, redirect: true });
  }

  // Ok, now we've handled if the user tries to remove themselves.
  // From here on, it's a user trying to delete another user.

  // Do they have permission to edit?
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({
      error: { message: 'User does not have permission to edit this team' },
    });
  }

  // Get the user that's being deleted
  const userToDelete = await dbClient.userFileRole.findUnique({
    where: {
      userId_fileId: {
        userId: userToDeleteId,
        fileId,
      },
    },
  });

  // Ensure they exist
  if (!userToDelete) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  // Ok, now we're good to delete the user
  await dbClient.userFileRole.delete({
    where: {
      userId_fileId: {
        userId: userToDeleteId,
        fileId,
      },
    },
  });

  return res.status(200).json(resSuccess);
}
