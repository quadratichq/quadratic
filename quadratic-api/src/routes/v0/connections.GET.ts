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

  const list = await dbClient.connection.findMany({
    where: {
      UserConnectionRole: {
        some: {
          userId,
        },
      },
    },
  });

  const resData = list.map(({ uuid, name, type, created_date, updated_date, database }) => ({
    uuid,
    name,
    type,
    created_date,
    updated_date,
    database,
  }));

  // @ts-ignore Fix error here with `type` that expects an enumerated string
  return res.status(200).json(resData);
}
