import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.DELETE.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);

  // get connection from DB, this ensures the user has access to it
  // TODO: (connections) ensure they have delete access...?
  await getConnection({ uuid, userId });

  // Delete the connetion and any associated user roles
  // TODO: (connections) do we want to do that? Or just mark it as archived

  await dbClient.connection.update({
    where: { uuid },
    data: { archived: new Date() },
  });

  return res.status(200).json({ message: 'Connection deleted' });
}
