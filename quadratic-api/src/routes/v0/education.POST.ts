import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

const schema = z.object({
  body: ApiSchemas['/v0/education.POST.request'],
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.POST.response']>) {
  const {
    user: { id },
  } = req;
  const {
    body: { eduStatus },
  } = parseRequest(req, schema);

  await dbClient.user.update({
    where: { id },
    data: { eduStatus },
  });

  return res.status(200).send({ eduStatus });
}
