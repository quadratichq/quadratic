import type { Response } from 'express';
import { getUsers } from 'quadratic-api/src/auth/auth';
import universityDomains from 'quadratic-api/src/data/universityDomains';
import dbClient from 'quadratic-api/src/dbClient';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
import { sanityClient } from 'quadratic-shared/sanityClient';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.POST.response']>) {
  const {
    user: { auth0Id, id, eduStatus: currentEduStatus },
  } = req;

  // We'll check whether the requesting user is eligible for education
  // and save that state to the DB.

  // Get info about the user
  const userById = await getUsers([{ id, auth0Id }]);
  const email = userById[id].email;

  const enrollUser = async () => {
    const newEduStatus = 'ENROLLED';
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: newEduStatus },
    });
    const responseData: ApiTypes['/v0/education.POST.response'] = { eduStatus: newEduStatus };
    return responseData;
  };

  // First let's check out giant list of exisiting universities
  const universityDomainMatches = universityDomains.filter((domain) => email.endsWith(domain));
  if (universityDomainMatches.length > 0) {
    const responseData = await enrollUser();
    return res.status(200).send(responseData);
  }

  // Second let's check the list we have in sanity
  const whitelist = await sanityClient.educationWhitelist.get();
  const sanityDomainMatches = whitelist.filter(({ emailSuffix }) => email.endsWith(emailSuffix));
  if (sanityDomainMatches.length > 0) {
    const responseData = await enrollUser();
    return res.status(200).send(responseData);
  }

  // If none of those check out, they’re INELIGIBLE
  const newEduStatus = 'INELIGIBLE';
  if (currentEduStatus !== newEduStatus) {
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: newEduStatus },
    });
  }

  return res.status(200).send({ eduStatus: newEduStatus });
}
