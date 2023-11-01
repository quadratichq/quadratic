import express, { Response } from 'express';
import { z } from 'zod';
import { ApiTypes } from '../../../../src/api/types';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateZodSchema } from '../../middleware/validateZodSchema';
import { Request } from '../../types/Request';
import { ResponseError } from '../../types/Response';
import { getTeamAccess } from '../../utils/access';
const router = express.Router();

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    userId: z.coerce.number(),
  }),
});

// Check that the user making the request:
// 1. Has EDITOR access or above to the team
// 2. Has a role equivalent to or higher than the user being deleted
// 3. If they're deleting themselves, and they're an owner, make sure there's at least one other owner

router.delete(
  '/:uuid/sharing/:userId',
  validateZodSchema(ReqSchema),
  validateAccessToken,
  userMiddleware,
  teamMiddleware,
  async (req: Request, res: Response<ApiTypes['/v0/teams/:uuid/sharing/:userId.DELETE.response'] | ResponseError>) => {
    const resSuccess = { message: 'User deleted' };
    const userToDeleteId = Number(req.params.userId);
    const userMakingRequestId = req.user.id;
    const teamId = req.team.id;

    // User making the request can access to the team
    const userMakingRequest = await dbClient.userTeamRole.findUnique({
      where: {
        userId_teamId: {
          userId: userMakingRequestId,
          teamId,
        },
      },
    });
    if (!userMakingRequest) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    // User deleting themselves (they can do it regardless of access controls)
    if (userMakingRequest.userId === userToDeleteId) {
      // If they're the owner, make sure there's another owner before deleting
      if (userMakingRequest.role === 'OWNER') {
        const teamUsers = await dbClient.userTeamRole.findMany({
          where: {
            teamId,
          },
        });
        const numberOfOwners = teamUsers.filter(({ role }) => role === 'OWNER').length;
        if (numberOfOwners === 1) {
          return res
            .status(403)
            .json({ error: { message: 'There must be another team owner for the user to leave.' } });
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

    // User making the request can edit the team
    const userMakingRequestAccess = getTeamAccess(userMakingRequest.role);
    if (!userMakingRequestAccess.includes('TEAM_EDIT')) {
      return res.status(403).json({ error: { message: 'User does not have access to edit this team' } });
    }

    const userToDelete = await dbClient.userTeamRole.findUnique({
      where: {
        userId_teamId: {
          userId: userToDeleteId,
          teamId,
        },
      },
    });
    if (userMakingRequest.role === 'EDITOR') {
      if (userToDelete.role === 'OWNER') {
        return res.status(403).json({ error: { message: 'User does not have the ability to delete an owner' } });
      }
    }

    if (userMakingRequest.role === 'OWNER' && userMakingRequest.id === userToDelete.id) {
    }

    console.log(userMakingRequest);

    // Check that the requested team exists and the user ga
    // const team = await dbClient.team.findUnique({
    //   where: {
    //     id: teamId,
    //   },
    // });
    // if (!team) {
    //   return res.status(404).json({ error: { message: 'Team not found' } });
    // }

    // await dbClient.userTeamRole.delete({
    //   where: {
    //     userId_teamId: {
    //       userId,
    //       teamId,
    //     },
    //   },
    // });

    // return res.status(200).json({ message: 'User deleted' });

    return res.status(500).json({ error: { message: 'Unreachable code' } });
  }
);

export default router;
