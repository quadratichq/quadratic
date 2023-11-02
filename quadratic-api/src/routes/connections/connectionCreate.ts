import express from 'express';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { CreateSecret, GetSecret } from './awsSecret';

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

    const secret = {
      username: 'test',
      password: 'test',
      host: 'test',
      port: 'test',
      database: 'test',
    };

    const response = await CreateSecret(JSON.stringify(secret));

    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const response2 = await GetSecret(response.ARN);

    console.log(response2);

    const new_connection = await dbClient.connection.create({
      data: {
        name: 'new connection',
        type: 'POSTGRES',
        database: JSON.stringify({
          non_sensitive_data: 'tbd',
        }),
        secretArn: response.ARN,

        UserConnectionRole: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
    });

    return res.status(201).json(new_connection);
  }
);

export default router;
