import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { PostgresConnectionConfiguration } from './types/Postgres';

const router = express.Router();

const SUPPORTED_CONNECTIONS = [PostgresConnectionConfiguration];

router.get(
  '/',
  validateAccessToken,
  userMiddleware,
  // TODO validate connection
  async (req: Request, res) => {
    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    return res.status(200).json(SUPPORTED_CONNECTIONS);
  }
);

export default router;
