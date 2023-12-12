import express, { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getAuth0Users } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithTeam } from '../../types/Request';
const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    params: z.object({
      uuid: z.string().uuid(),
    }),
  })
);

router.get(
  '/:uuid',
  requestValidationMiddleware,
  teamMiddleware,
  async (req: Request, res: Response<ApiTypes['/v0/teams/:uuid.GET.response']>) => {
    const {
      user: { id: userId },
      team: {
        data: team,
        data: { id: teamId },
        user: teamUser,
      },
    } = req as RequestWithTeam;

    // Get users in the team
    const dbTeam = await dbClient.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        UserTeamRole: {
          include: {
            user: true,
          },
          orderBy: {
            createdDate: 'asc',
          },
        },
        TeamInvite: {
          orderBy: {
            createdDate: 'asc',
          },
        },
      },
    });

    const dbUsers = dbTeam?.UserTeamRole ? dbTeam.UserTeamRole : [];
    const dbInvitedUsers = dbTeam?.TeamInvite ? dbTeam.TeamInvite : [];

    const auth0UserIds = dbUsers.map(({ user: { auth0_id } }) => auth0_id);

    // Get auth0 users
    const auth0Users = await getAuth0Users(auth0UserIds);
    // @ts-expect-error fix types
    const auth0UsersByAuth0Id: Record<string, (typeof auth0Users)[0]> = auth0Users.reduce(
      // @ts-expect-error fix types
      (acc, auth0User) => ({ ...acc, [auth0User.user_id]: auth0User }),
      {}
    );

    // TODO: sort users by created_date in the team
    // TODO: invited users, also can we guarantee ordering here?
    const users = dbUsers.map(({ userId: id, role, user: { auth0_id } }) => {
      const { email, name, picture } = auth0UsersByAuth0Id[auth0_id];
      return {
        id,
        email,
        role,
        hasAccount: true,
        name,
        picture,
      };
    });

    const response = {
      team: {
        uuid: team.uuid,
        name: team.name,
        created_date: team.createdDate,
        ...(team.picture ? { picture: team.picture } : {}),
        // TODO we could put this in /sharing and just return the userCount
        users,
        invitedUsers: dbInvitedUsers.map(({ email, role }) => ({ email, role })),

        files: [],
      },
      user: {
        id: userId,
        role: teamUser.role,
        access: teamUser.access,
      },
    };

    // @ts-expect-error TODO: fix types
    return res.status(200).json(response);
  }
);

export default router;
