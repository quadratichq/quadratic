import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';
const universityDomains: string[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../data/universityDomains.json')).toString()
);

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.GET.response']>) {
  const {
    user: { auth0Id, id, eduStatus },
  } = req;

  // If the eduStatus hasn’t been set yet, or they're ineligible, we'll check
  // whether they’re eligible and save that state to the DB. Otherwise we just
  // return the current status;
  if (!(eduStatus === 'INELIGIBLE' || eduStatus === null)) {
    return res.status(200).send({ eduStatus });
  }

  // Get info about the user
  const userById = await getUsersFromAuth0([{ id, auth0Id }]);
  const email = userById[id].email;

  const markUserAsEligible = async () => {
    const newEduStatus = 'ELIGIBLE';
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: 'ELIGIBLE' },
    });
    const responseData: ApiTypes['/v0/education.GET.response'] = { eduStatus: newEduStatus };
    return responseData;
  };

  // First let's check out giant list of exisiting universities
  const universityDomainMatches = universityDomains.filter((domain) => email.endsWith(domain));
  if (universityDomainMatches.length > 0) {
    const responseData = await markUserAsEligible();
    return res.status(200).send(responseData);
  }

  // Second let's check the list we have in sanity
  const { educationDomainWhitelist } = await sanityClient.appSettings.get();
  const sanityDomainMatches = educationDomainWhitelist.filter((str) => email.endsWith(str));
  if (sanityDomainMatches.length > 0) {
    const responseData = await markUserAsEligible();
    return res.status(200).send(responseData);
  }

  // If none of those check out, they’re INELIGIBLE
  const newEduStatus = 'INELIGIBLE';

  // If their status was null, set it to INELIGIBLE
  if (eduStatus === null) {
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: newEduStatus },
    });
  }

  return res.status(200).send({ eduStatus: newEduStatus });
}
