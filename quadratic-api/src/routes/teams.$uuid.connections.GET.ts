// @ts-nocheck
import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections.GET.response']>) {
  const {
    user: { id: userId },
  } = req;

  // get connections belonging to a user
  const list = await dbClient.connection.findMany({
    where: {
      archived: null,
      UserConnectionRole: {
        some: {
          userId,
        },
      },
    },
    orderBy: {
      updatedDate: 'desc',
    },
  });

  const data = list.map(({ uuid, name, type, createdDate, updatedDate }) => ({
    uuid,
    name,
    type,
    createdDate: createdDate.toISOString(),
    updatedDate: updatedDate.toISOString(),
  }));

  // There's a mismatch between the type in the db schema and the type in the API
  return res.status(200).json(data);
}
