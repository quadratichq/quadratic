import express, { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    params: z.object({
      uuid: z.string().uuid(),
      userId: z.coerce.number(),
    }),
  })
);

router.delete(
  '/:uuid/users/:userId',
  requestValidationMiddleware,
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const resSuccess: ApiTypes['/v0/teams/:uuid/users/:userId.DELETE.response'] = { message: 'User deleted' };
    const {
      user: { id: userMakingRequestId },
      params: { userId: userIdString },
    } = req as RequestWithUser;
    const userToDeleteId = Number(userIdString);
    const {
      file: { id: fileId },
      user: userMakingRequest,
    } = await getFile({ uuid: req.params.uuid, userId: userMakingRequestId });

    // User deleting themselves?
    if (userMakingRequestId === userToDeleteId) {
      // Can't delete yourself as the owner
      if (userMakingRequest.role === 'OWNER') {
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
      return res.status(200).json(resSuccess);
    }

    // Ok, now we've handled if the user tries to remove themselves from a team.
    // From here on, it's a user trying to delete another user

    // User making the request can edit the team
    if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
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
    // And make sure they have a role equal to or lower than the deleter
    if (userMakingRequest.role === 'EDITOR' && userToDelete.role === 'OWNER') {
      return res.status(403).json({
        error: {
          message: 'User does not have the ability to delete an owner',
        },
      });
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
);

export default router;
