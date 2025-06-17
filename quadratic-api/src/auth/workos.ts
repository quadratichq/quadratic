import * as Sentry from '@sentry/node';
import { WorkOS } from '@workos-inc/node';
import type { Algorithm } from 'jsonwebtoken';
import JwksRsa, { type GetVerificationKey } from 'jwks-rsa';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_JWKS_URI } from '../env-vars';
import type { ByEmailUser, User } from './auth';

let workos: WorkOS | undefined;
const getWorkos = (): WorkOS => {
  if (!workos) {
    workos = new WorkOS(WORKOS_API_KEY, {
      clientId: WORKOS_CLIENT_ID,
    });
  }
  return workos;
};

export const getUsersFromWorkos = async (users: { id: number; auth0Id: string }[]): Promise<Record<number, User>> => {
  // If we got nothing, we return an empty object
  if (users.length === 0) return {};

  // Map the users we found by their Quadratic ID
  const usersById: Record<number, User> = {};

  const promises = users.map(async ({ id, auth0Id }) => {
    try {
      const workosUser = await getWorkos().userManagement.getUser(auth0Id);
      usersById[id] = {
        id,
        auth0Id,
        email: workosUser.email,
        name: `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim(),
        picture: workosUser.profilePictureUrl ?? undefined,
      };
    } catch (e) {
      // if user is not found, log the error
      console.error(e);
      Sentry.captureException({
        message: 'Failed to retrieve user info from Workos',
        level: 'error',
        extra: {
          auth0IdInOurDb: auth0Id,
          workosError: e,
        },
      });

      // and throw an error back to exit from the request
      throw new Error('Failed to retrieve all user info from Workos');
    }
  });

  await Promise.all(promises);

  return usersById;
};

export const getUsersFromWorkosByEmail = async (email: string): Promise<ByEmailUser[]> => {
  let identities;

  try {
    identities = (await getWorkos().userManagement.listUsers({ email })).data;
  } catch (e) {
    console.error(e);
    return [];
  }

  return identities.map(({ id }) => ({ user_id: id }));
};

export const jwtConfigWorkos = {
  secret: JwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: WORKOS_JWKS_URI,
  }) as GetVerificationKey,
  algorithms: ['RS256'] as Algorithm[],
};
