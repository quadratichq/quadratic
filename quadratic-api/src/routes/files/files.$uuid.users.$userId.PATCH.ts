import express, { Request, Response } from 'express';
import { /* ApiSchemas, */ ApiSchemas, ApiTypes, UserRoleFileSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';
const { OWNER } = UserRoleFileSchema.enum;

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    params: z.object({
      uuid: z.string().uuid(),
      userId: z.coerce.number(),
    }),
    body: ApiSchemas['/v0/teams/:uuid/users/:userId.POST.request'],
  })
);

router.patch(
  '/:uuid/users/:userId',
  requestValidationMiddleware,
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const {
      user: { id: userMakingChangeId },
      params: { uuid, userId },
    } = req as RequestWithUser;
    const { role: newRole } = req.body as ApiTypes['/v0/files/:uuid/users/:userId.PATCH.request'];
    const {
      file: { id: fileId },
      user: fileUser,
    } = await getFile({ uuid, userId: userMakingChangeId });
    const userBeingChangedId = Number(userId);

    // User is trying to update their own role
    if (userBeingChangedId === userMakingChangeId) {
      const currentRole = fileUser.role;

      // To the same role
      if (newRole === currentRole) {
        return res.status(200).json({ role: newRole });
      }

      // Upgrading role
      if (newRole === OWNER) {
        return res.status(403).json({ error: { message: 'Cannot upgrade to owner of the file' } });
      }
      if (firstRoleIsHigherThanSecond(newRole, currentRole)) {
        return res.status(403).json({ error: { message: 'Cannot upgrade to a role higher than your own' } });
      }

      // Downgrading role
      if (currentRole === OWNER) {
        return res.status(403).json({
          error: { message: 'User cannot downgrade themselves as an owner.' },
        });
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

    if (!fileUser.permissions.includes('FILE_EDIT')) {
      return res.status(403).json({
        error: { message: 'You do not have permission to edit others' },
      });
    }
    if (newRole === OWNER) {
      return res.status(403).json({ error: { message: "You cannot change another user's role to owner" } });
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
    const userMakingChangeRole = fileUser.role;

    // Changing to the same role?
    if (newRole === userBeingChangedRole) {
      return res.status(200).json({ role: newRole });
    }

    // Upgrading to a role higher than their own? Not so fast!
    if (firstRoleIsHigherThanSecond(userBeingChangedRole, userMakingChangeRole)) {
      return res.status(403).json({
        error: {
          message: 'You cannot upgrade another user’s role to one higher than your own',
        },
      });
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

    const data: ApiTypes['/v0/teams/:uuid/users/:userId.POST.response'] = { role: newUserFileRole.role };
    return res.status(200).json(data);
  }
);

export default router;
