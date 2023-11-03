import express, { Response } from 'express';
import { z } from 'zod';
import { ApiTypes } from '../../../../src/api/types';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';

const router = express.Router();

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    userId: z.coerce.number(),
  }),
});

router.delete(
  '/:uuid/sharing/:userId',
  validateRequestAgainstZodSchema(ReqSchema),
  validateAccessToken,
  userMiddleware,
  teamMiddleware,
  async (
    req: RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid/sharing/:userId.DELETE.response'] | ResponseError>
  ) => {
    const resSuccess = { message: 'User deleted' };
    const userToDeleteId = Number(req.params.userId);
    const userMakingRequestId = req.user.id;
    const {
      team: {
        data: { id: teamId },
        user: userMakingRequest,
      },
    } = req;

    // Allow the user to delete themselves from a team
    if (userMakingRequestId === userToDeleteId) {
      // If they're the owner, make sure there's another owner before deleting
      if (userMakingRequest.role === 'OWNER') {
        const teamOwners = await dbClient.userTeamRole.findMany({
          where: {
            teamId,
            role: 'OWNER',
          },
        });
        if (teamOwners.length <= 1) {
          return res.status(403).json({ error: { message: 'There must be at least one owner on a team.' } });
        }
      }

      // Delete!
      await dbClient.userTeamRole.delete({
        where: {
          userId_teamId: {
            userId: userToDeleteId,
            teamId,
          },
        },
      });
      return res.status(200).json(resSuccess);
    }

    // Ok, now we've handled if the user tries to remove themselves from a team.
    // From here on, it's a user trying to delete another user

    // User making the request can edit the team
    if (!userMakingRequest.access.includes('TEAM_EDIT')) {
      return res.status(403).json({ error: { message: 'User does not have access to edit this team' } });
    }

    // Get the user that's being deleted
    const userToDelete = await dbClient.userTeamRole.findUnique({
      where: {
        userId_teamId: {
          userId: userToDeleteId,
          teamId,
        },
      },
    });
    // Ensure they exist
    if (!userToDelete) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    // And make sure they have a role equal to or lower than the deleter
    if (userMakingRequest.role === 'EDITOR' && userToDelete.role === 'OWNER') {
      return res.status(403).json({ error: { message: 'User does not have the ability to delete an owner' } });
    }

    // Ok, now we're good to delete the user
    await dbClient.userTeamRole.delete({
      where: {
        userId_teamId: {
          userId: userToDeleteId,
          teamId,
        },
      },
    });
    return res.status(200).json(resSuccess);
  }
);

export default router;
