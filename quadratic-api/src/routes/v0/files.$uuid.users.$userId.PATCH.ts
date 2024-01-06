import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
        userId: z.coerce.number(),
      }),
      body: ApiSchemas['/v0/teams/:uuid/users/:userId.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    user: { id: userMakingChangeId },
    params: { uuid, userId },
  } = req as RequestWithUser;
  const { role: newRole } = req.body as ApiTypes['/v0/files/:uuid/users/:userId.PATCH.request'];
  const {
    file: { id: fileId },
    userMakingRequest,
  } = await getFile({ uuid, userId: userMakingChangeId });
  const userBeingChangedId = Number(userId);

  // User is trying to update their own role
  if (userBeingChangedId === userMakingChangeId) {
    const currentRole = userMakingRequest.fileRole;

    // To the same role
    if (newRole === currentRole) {
      return res.status(200).json({ role: newRole });
    }

    // TODO: is this still necessary?
    // Upgrading role
    if (firstRoleIsHigherThanSecond(newRole, currentRole)) {
      return res.status(403).json({ error: { message: 'Cannot upgrade to a role higher than your own' } });
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
    return res.status(403).json({
      error: { message: 'You do not have permission to edit others' },
    });
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
    return res.status(404).json({ error: { message: `The user you’re trying to change could not found.` } });
  }
  const userBeingChangedRole = userBeingChanged.role;

  // Changing to the same role?
  if (newRole === userBeingChangedRole) {
    return res.status(200).json({ role: newRole });
  }

  // Downgrading is ok!
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

  const data: ApiTypes['/v0/files/:uuid/users/:userId.PATCH.response'] = { role: newUserFileRole.role };
  return res.status(200).json(data);
}
