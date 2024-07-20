import { Request, Response } from 'express';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
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
        userId: z.coerce.number(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/users/:userId.DELETE.response']>) {
  const {
    user: { id: userMakingRequestId },
    params: { userId: userIdString },
  } = req as RequestWithUser;
  const userToDeleteId = Number(userIdString);
  const {
    file: { id: fileId, ownerUserId },
    userMakingRequest,
  } = await getFile({ uuid: req.params.uuid, userId: userMakingRequestId });

  // Trying to delete yourself?
  if (userMakingRequestId === userToDeleteId) {
    // Not ok if you're the owner
    if (ownerUserId === userMakingRequest.id) {
      throw new ApiError(400, 'You cannot delete yourself as the file owner.');
    }

    // Otherwise, delete!
    const deletedUserFileRole = await dbClient.userFileRole.delete({
      where: {
        userId_fileId: {
          userId: userToDeleteId,
          fileId,
        },
      },
    });

    // TODO: we could _only_ redirect in certain scenarios because the user
    // may still have access to the file. For example:
    //   1. The user removed themselves from a file whose public link makes it accessible
    //   2. The user removed themselves from a file they already have access to
    //      to as a team user.
    // But to do this, we'd have to update the front-end to respond to their new
    // permissions in relation to the file — which is a bit more work.
    // So we'll always redirect when you delete yourself.
    return res.status(200).json({ id: deletedUserFileRole.userId, redirect: true });
  }

  // Ok, now we've handled if the user tries to remove themselves.
  // From here on, it's a user trying to delete another user.

  // Do they have permission to edit?
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'User does not have permission to edit this file');
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
    throw new ApiError(404, 'The user being deleted is not associated with this file');
  }

  // Ok, now we're good to delete the user
  const deletedUserFileRole = await dbClient.userFileRole.delete({
    where: {
      userId_fileId: {
        userId: userToDeleteId,
        fileId,
      },
    },
  });

  return res.status(200).json({ id: deletedUserFileRole.userId });
}
