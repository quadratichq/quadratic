import { Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    userId: z.coerce.number(),
  }),
  body: ApiSchemas['/v0/files/:uuid/users/:userId.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/users/:userId.PATCH.response']>) {
  const {
    body: { role: newRole },
    params: { uuid, userId: userBeingChangedId },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req;
  const {
    file: { id: fileId, ownerUserId, publicLinkAccess },
    userMakingRequest,
  } = await getFile({ uuid, userId: userMakingRequestId });

  // Updating yourself?
  if (userBeingChangedId === userMakingRequestId) {
    const currentRole = userMakingRequest.fileRole;

    // Can’t update your own role as file owner (not possible through the UI, but just in case)
    if (userMakingRequestId === ownerUserId) {
      throw new ApiError(400, 'Cannot change your own role as the file owner');
    }

    // To the same role
    if (newRole === currentRole) {
      return res.status(200).json({ role: newRole });
    }

    // Upgrading role
    // (e.g. a VIEWER could upgrade to EDITOR if the public link access is EDIT)
    if (firstRoleIsHigherThanSecond(newRole, currentRole) && publicLinkAccess !== 'EDIT') {
      throw new ApiError(403, 'Cannot upgrade to a role higher than your own');
    }

    // Make the change!
    const newUserFileRole = await dbClient.userFileRole.update({
      where: {
        userId_fileId: {
          userId: userBeingChangedId,
          fileId: fileId,
        },
      },
      data: {
        role: newRole,
      },
    });
    return res.status(200).json({ role: newUserFileRole.role });
  }

  // If we hit here, the user is trying to change somebody else's role
  // So we'll check and make sure they can

  // First, can they do this?
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'You do not have permission to edit others');
  }

  // Lookup the user that's being changed and their current role
  const userBeingChanged = await dbClient.userFileRole.findUnique({
    where: {
      userId_fileId: {
        userId: userBeingChangedId,
        fileId,
      },
    },
  });
  if (userBeingChanged === null) {
    throw new ApiError(404, 'The user you’re trying to change could not found.');
  }
  const userBeingChangedRole = userBeingChanged.role;

  // Changing to the same role?
  if (newRole === userBeingChangedRole) {
    return res.status(200).json({ role: newRole });
  }

  // Make the change!
  const newUserFileRole = await dbClient.userFileRole.update({
    where: {
      userId_fileId: {
        userId: userBeingChangedId,
        fileId,
      },
    },
    data: {
      role: newRole,
    },
  });

  return res.status(200).json({ role: newUserFileRole.role });
}
