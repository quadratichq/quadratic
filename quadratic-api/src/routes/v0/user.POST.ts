import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
const universities: { domains: string[] }[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../data/universities.json')).toString()
);

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/user.POST.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: { eduStatus },
  } = parseRequest(req, schema);

  // Turn on/off eduStatus

  const { eduStatus: newEduStatus } = await dbClient.user.update({
    where: { id: userId },
    data: { eduStatus },
  });

  return res.status(200).json({ eduStatus: newEduStatus } as ApiTypes['/v0/user.POST.response']);
}
