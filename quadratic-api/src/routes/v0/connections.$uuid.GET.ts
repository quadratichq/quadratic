import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { decryptFromEnv } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const connection = await getConnection({ uuid, userId });

  // if (connection.typeDetails === null) {
  //   throw new ApiError(404, `Expected typeDetails to be set for connection ${uuid}.`);
  // }

  const typeDetails = decryptFromEnv(connection.typeDetails.toString());

  return res.status(200).json({
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    typeDetails: JSON.parse(typeDetails),
  });
}
