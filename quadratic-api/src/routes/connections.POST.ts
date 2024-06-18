// @ts-nocheck
import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
// import { CreateSecret } from '../connections/awsSecret';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/connections.POST.request'],
});

/**
 * The front-end should call the connetion service BEFORE creating this
 * just to ensure it works.
 */
async function handler(req: RequestWithUser, res: Response<ResponseError | ApiTypes['/v0/connections.POST.response']>) {
  const {
    user: { id: userId },
  } = req;
  const { body: connection } = parseRequest(req, schema);

  const { name, type, typeDetails } = connection;
  const result = await dbClient.connection.create({
    data: {
      name,
      type,
      typeDetails: JSON.stringify(typeDetails),
      UserConnectionRole: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return res.status(201).json({ uuid: result.uuid });
}
