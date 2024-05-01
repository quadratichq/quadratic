import { Response } from 'express';
import { ApiTypes, ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
// import { CreateSecret } from '../connections/awsSecret';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/connections/create/postgres.POST.request'],
});

/**
 * The front-end should call the connetion service BEFORE creating this
 * just to ensure it works.
 */
async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/create/postgres.POST.response']>) {
  const {
    user: { id: userId },
  } = req;
  const { body: connection } = parseRequest(req, schema);

  // const response = await CreateSecret(JSON.stringify(connection));
  // if (response.$metadata.httpStatusCode !== 200) {
  //   return res.status(500).json({ error: { message: 'Credential was not created successfully' } });
  // }

  await dbClient.connection.create({
    data: {
      name: connection.name,
      type: 'POSTGRES',
      database: JSON.stringify({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
      }),
      UserConnectionRole: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return res.status(201).json({ message: 'Ok' });
}
