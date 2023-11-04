import express from 'express';
import { z } from 'zod';
import { ApiSchemas } from '../../../../src/api/types';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { Request } from '../../types/Request';
import { CreateSecret } from './awsSecret';

const router = express.Router();

const Schema = z.object({
  body: ApiSchemas['/v0/connections.POST.request'],
});

router.post(
  '/',
  validateAccessToken,
  userMiddleware,
  // TODO validate connection
  validateRequestAgainstZodSchema(Schema),
  async (req: Request, res) => {
    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const connection = {
      username: req.body.username,
      password: req.body.password,
      host: req.body.host,
      port: req.body.port,
      database: req.body.database,
      name: req.body.name,
    };

    const response = await CreateSecret(JSON.stringify(connection));

    if (response.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ error: { message: 'Credential was not created successfully' } });
    }

    const new_connection = await dbClient.connection.create({
      data: {
        name: connection.name,
        type: 'POSTGRES',
        database: JSON.stringify({
          non_sensitive_data: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            username: connection.username,
          },
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
