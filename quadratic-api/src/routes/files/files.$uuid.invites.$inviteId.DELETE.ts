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
      inviteId: z.coerce.number(),
    }),
  })
);

router.delete(
  '/:uuid/invites/:inviteId',
  requestValidationMiddleware,
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const {
      params: { uuid, inviteId },
      user: { id: userId },
    } = req as RequestWithUser;
    const inviteToDelete = Number(inviteId);
    const { user: userMakingRequest } = await getFile({ uuid, userId });

    // User making the request can edit the team
    if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
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
);

export default router;
