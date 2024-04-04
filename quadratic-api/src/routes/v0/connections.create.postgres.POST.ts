import { Response } from 'express';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { CreateSecret } from '../connections/awsSecret';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/connections.POST.request'],
});

async function handler(req: RequestWithUser, res: Response) {
  const {
    user: { id: userId },
  } = req;
  const { body } = parseRequest(req, schema);

  const connection = {
    username: body.username,
    password: body.password,
    host: body.host,
    port: body.port,
    database: body.database,
    name: body.name,
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
      secretArn: response.ARN || '',

      UserConnectionRole: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return res.status(201).json(new_connection);
}
