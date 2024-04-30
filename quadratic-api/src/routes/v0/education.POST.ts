import { Response } from 'express';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import universityDomains from '../../data/universityDomains';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

const schema = z.object({
  body: ApiSchemas['/v0/education.POST.request'],
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/education.POST.response']>) {
  const {
    user: { auth0Id, id, eduStatus: currentEduStatus },
  } = req;
  const { body } = parseRequest(req, schema);

  // You gotta pass _something_
  if (body.eduStatus === undefined && body.refresh === undefined) {
    throw new ApiError(400, 'Invalid request. Must send `eduStatus` or `refresh` in the body.');
  }

  // If we were passed a body, we'll update the user’s eduStatus
  if (body.eduStatus) {
    await dbClient.user.update({
      where: { id },
      data: { eduStatus: body.eduStatus },
    });
    return res.status(200).send({ eduStatus: body.eduStatus });
  }

  // Otherwise we'll check whether the requesting user is eligible for education
  // and save that state to the DB.

  // Get info about the user
  const userById = await getUsersFromAuth0([{ id, auth0Id }]);
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
