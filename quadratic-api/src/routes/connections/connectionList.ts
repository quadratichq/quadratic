import express from 'express';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';

const router = express.Router();

router.get(
  '/',
  validateAccessToken,
  userMiddleware,
  // TODO validate connection
  async (req: Request, res) => {
    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const list = await dbClient.connection.findMany({
      where: {
        UserConnectionRole: {
          some: {
            userId: req.user.id,
          },
        },
      },
    });

    return res.status(200).json(list);
  }
);

export default router;
