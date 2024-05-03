import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
// import { CreateSecret } from '../connections/awsSecret';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/connections/:uuid.PUT.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.PUT.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: newConnection,
    params: { uuid },
  } = parseRequest(req, schema);

  // get connection from DB, this ensures the user has access to it
  // TODO: ensure they have write access...?
  await getConnection({ uuid, userId });

  const { name, database } = newConnection;
  const updatedConnection = await dbClient.connection.update({
    where: { uuid },
    data: {
      name,
      updatedDate: new Date(),
      database: JSON.stringify(database),
    },
  });

  return res.status(200).json({
    name: updatedConnection.name,
    uuid: updatedConnection.uuid,
    createdDate: updatedConnection.createdDate.toISOString(),
    updatedDate: updatedConnection.updatedDate.toISOString(),
    // @ts-expect-error TODO: fix types here because it IS a string
    type: updatedConnection.type,
    // @ts-expect-error TODO: fix types
    database: JSON.parse(updatedConnection.database),
  });
}
