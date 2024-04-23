import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
const universityDomains: string[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../data/universityDomains.json')).toString()
);

const schema = z.object({
  body: ApiSchemas['/v0/education.POST.request'],
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.POST.response']>) {
  const {
    user: { id, eduStatus },
  } = req;
  const {
    body: { email },
  } = parseRequest(req, schema);
  console.log('Checking for email', email);

  // If they’re enrolled, just return their status
  if (eduStatus === 'ENROLLED') {
    return res.status(200).send({ eduStatus, isNewlyEnrolled: false });
  }

  // If the eduStatus hasn’t been set yet, or they're ineligible, we'll check
  // whether they’re eligible and save that state to the DB

  // First let's check out giant list of exisiting universities
  const universityDomainMatches = universityDomains.filter((domain) => email.endsWith(domain));
  console.log('Do they match anything in the universities file?', email, universityDomainMatches);
  if (universityDomainMatches.length > 0) {
    const newEduStatus = 'ENROLLED';
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: 'ENROLLED' },
    });
    return res.status(200).send({ eduStatus: newEduStatus, isNewlyEnrolled: true });
  }

  // Second let's check the list we have in sanity
  const { educationDomainWhitelist } = await sanityClient.appSettings.get();
  const sanityDomainMatches = educationDomainWhitelist.filter((str) => email.endsWith(str));
  console.log('Do they match anything in the sanity list?', email, sanityDomainMatches, educationDomainWhitelist);
  if (sanityDomainMatches.length > 0) {
    const newEduStatus = 'ENROLLED';
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: 'ENROLLED' },
    });
    return res.status(200).send({ eduStatus: newEduStatus, isNewlyEnrolled: true });
  }

  // If none of those check out, they’re INELIGIBLE
  const newEduStatus = 'INELIGIBLE';

  // If their status was null, set it to INELIGIBLE
  if (eduStatus === null) {
    console.log('They were null, set to ineligible');
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: newEduStatus },
    });
  }

  console.log('They’re ineligible');
  return res.status(200).send({ eduStatus: newEduStatus, isNewlyEnrolled: false });
}
