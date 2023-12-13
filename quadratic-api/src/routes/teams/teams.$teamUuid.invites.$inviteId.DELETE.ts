import express, { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithTeam } from '../../types/Request';
import { ResponseError } from '../../types/Response';

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
  teamMiddleware,
  async (
    req: Request,
    res: Response<ApiTypes['/v0/teams/:uuid/invites/:inviteId.DELETE.response'] | ResponseError>
  ) => {
    const inviteToDelete = Number(req.params.inviteId);
    const {
      team: { user: userMakingRequest },
    } = req as RequestWithTeam;

    // TODO: write tests for this endpoint

    // User making the request can edit the team
    if (!userMakingRequest.access.includes('TEAM_EDIT')) {
      return res.status(403).json({
        error: { message: 'User does not have access to edit this team' },
      });
    }

    // Ok, delete the invite
    await dbClient.teamInvite.delete({
      where: {
        id: inviteToDelete,
      },
    });
    return res.status(200).json({ message: 'Invite deleted' });
  }
);

export default router;
