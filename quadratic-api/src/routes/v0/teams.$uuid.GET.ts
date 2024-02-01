import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;
  const {
    team,
    team: { id: teamId },
    user: teamUser,
  } = await getTeam({ uuid, userId });

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
  const dbInvites = dbTeam?.TeamInvite ? dbTeam.TeamInvite : [];

  // Get auth0 users
  const auth0UsersById = await getUsersFromAuth0(dbUsers.map(({ user }) => user));

  // TODO: sort users by createdDate in the team
  // TODO: invited users, also can we guarantee ordering here?
  const users = dbUsers.map(({ userId: id, role }) => {
    const { email, name, picture } = auth0UsersById[id];
    return {
      id,
      email,
      role,
      name,
      picture,
    };
  });

  const response: ApiTypes['/v0/teams/:uuid.GET.response'] = {
    team: {
      uuid: team.uuid,
      name: team.name,
      ...(team.picture ? { picture: team.picture } : {}),
    },
    userMakingRequest: {
      id: userId,
      teamRole: teamUser.role,
      teamPermissions: teamUser.permissions,
    },
    // TODO we could put this in /sharing and just return the userCount
    users,
    invites: dbInvites.map(({ email, role, id }) => ({ email, role, id })),
    // files: [],
  };

  return res.status(200).json(response);
}
