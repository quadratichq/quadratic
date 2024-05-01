import { Response } from 'express';
import z from 'zod';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getConnection } from '../../middleware/getConnection';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [validateM2MAuth, validateAccessToken, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const connection = await getConnection({ uuid, userId });

  const data = {
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    // TODO: fix types, don't send sensitive info
    database: connection.database,
  };
  return res.status(200).json(data);
}
