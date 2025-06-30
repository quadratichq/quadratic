import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { RequestWithUser } from '../../types/Request';
import { getTeamPermissions } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: Request, res: Response<ApiTypes['/v0/teams.GET.response']>) {
  const { user } = req as RequestWithUser;

  // Fetch teams the user is a part of
  const dbTeams = await dbClient.userTeamRole.findMany({
    where: {
      userId: user.id,
    },
    select: {
      team: {
        select: {
          id: true,
          uuid: true,
          name: true,
          createdDate: true,
          // Count the number of users in each team
          _count: {
            select: {
              UserTeamRole: true,
            },
          },
        },
      },
      role: true,
    },
    orderBy: [
      {
        team: {
          createdDate: 'asc',
        },
      },
    ],
  });

  const teams = dbTeams.map(({ team, role }) => {
    const { _count, ...teamData } = team;
    return {
      team: teamData,
      users: _count.UserTeamRole,
      userMakingRequest: {
        teamPermissions: getTeamPermissions(role),
      },
    };
  });

  return res.status(200).json({ teams, userMakingRequest: { id: user.id } });
}
