import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: Request, res: Response) {
  const { user } = req as RequestWithUser;

  // Fetch teams the user is a part of
  const teams = await dbClient.userTeamRole.findMany({
    where: {
      userId: user.id,
    },
    select: {
      team: {
        select: {
          uuid: true,
          name: true,
          createdDate: true,
          picture: true,
        },
      },
    },
    orderBy: [
      {
        team: {
          createdDate: 'asc',
        },
      },
    ],
  });

  // Make picture optional when available
  const clientTeams = teams.map(({ team: { picture, ...rest } }) => ({
    ...rest,
    ...(picture ? { picture } : {}),
  }));

  const data: ApiTypes['/v0/teams.GET.response'] = clientTeams;
  return res.status(200).json(data);
}
