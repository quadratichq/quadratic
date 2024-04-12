import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';
const universities: { domains: string[] }[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../data/universities.json')).toString()
);

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/users/:auth0Id.GET.response']>) {
  const {
    user: { auth0Id, id, eduStatus },
  } = req;

  // If the eduStatus hasn’t been set yet, we'll process whether they’re eligible
  let newEduStatus = eduStatus === null ? undefined : eduStatus;
  if (newEduStatus === undefined) {
    // TODO: Should we do this? Or have the user pass up the email too?
    const usersById = await getUsersFromAuth0([{ id, auth0Id }]);

    const { email } = usersById[id];
    const matches = universities.filter((u) => u.domains.some((d) => email.endsWith(d)));
    console.log(matches);

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
