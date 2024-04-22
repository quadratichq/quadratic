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

const schema = z.object({
  body: ApiSchemas['/v0/education.POST.request'],
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.POST.response']>) {
  const {
    user: { auth0Id, id, eduStatus },
  } = req;
  const { email } = parseRequest(req, schema);

  // If the eduStatus hasn’t been set yet, we'll process whether they’re eligible
  let newEduStatus = eduStatus === null ? undefined : eduStatus;
  if (newEduStatus === undefined) {
    const matches = universities.filter((u) => u.domains.some((d) => email.endsWith(d)));
    console.log('Checking for matches', email, matches);

    // TODO: Get list of eligible domains from Sanity

    if (matches.length > 0) {
      newEduStatus = 'ELIGIBLE';
      await dbClient.user.update({
        where: { id },
        data: { eduStatus: newEduStatus },
      });
    } else {
      newEduStatus = 'INELIGIBLE';
      await dbClient.user.update({
        where: { id },
        data: { eduStatus: newEduStatus },
      });
    }
    // fetch stuff and do your thing
  }

  return res.status(200).json({ id, eduStatus: newEduStatus });
}
