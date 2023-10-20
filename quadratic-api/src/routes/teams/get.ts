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

  // Fetch files owned by the user from the database
  const teams = await dbClient.team.findMany({
    where: {
      UserTeamRole: {
        every: {
          userId: req.user.id,
        },
      },
    },
    select: {
      uuid: true,
      name: true,
      created_date: true,
      picture: true,
    },
    orderBy: [
      {
        created_date: 'asc',
      },
    ],
  });

  return res.status(200).json(teams);
});

export default router;
