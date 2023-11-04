import express from 'express';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { GetSecret } from './awsSecret';

const router = express.Router();

router.post(
  '/',
  validateAccessToken,
  userMiddleware,
  // TODO validate connection
  async (req: Request, res) => {
    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const connection = await dbClient.connection.findFirstOrThrow({
      where: {
        uuid: req.params.uuid,
      },
    });

    const connection_secret = await GetSecret(connection.secretArn);

    // TODO: run query
    console.log(connection);
    console.log(connection_secret);

    return res.status(200).json({});
  }
);

export default router;
