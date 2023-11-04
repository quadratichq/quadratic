import express from 'express';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
const router = express.Router();

router.get('/', validateAccessToken, userMiddleware, async (req: Request, res) => {
  if (!req.user) {
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }

  // Fetch teams the user is a part of
  // const teams = await dbClient.team.findMany({
  //   where: {
  //     UserTeamRole: {
  //       every: {
  //         userId: req.user.id,
  //       },
  //     },
  //   },
  //   select: {
  //     uuid: true,
  //     name: true,
  //     created_date: true,
  //     picture: true,
  //   },
  //   orderBy: [
  //     {
  //       created_date: 'asc',
  //     },
  //   ],
  // });
  const teams = await dbClient.userTeamRole.findMany({
    where: {
      userId: req.user.id,
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

  return res.status(200).json(clientTeams);
});

export default router;
