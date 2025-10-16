import * as Sentry from '@sentry/node';
import { WorkOS } from '@workos-inc/node';
import type { Algorithm } from 'jsonwebtoken';
import JwksRsa, { type GetVerificationKey } from 'jwks-rsa';
import { JWKS_URI, WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';
import logger from '../../utils/logger';
import type { User, UsersRequest } from './auth';

let workos: WorkOS | undefined;
const getWorkos = (): WorkOS => {
  if (!workos) {
    workos = new WorkOS(WORKOS_API_KEY, {
      clientId: WORKOS_CLIENT_ID,
    });
  }
  return workos;
};

export const getUsersFromWorkos = async (users: UsersRequest[]): Promise<Record<number, User>> => {
  // If we got nothing, we return an empty object
  if (users.length === 0) return {};

  // Map the users we found by their Quadratic ID
  const usersById: Record<number, User> = {};

  const promises = users.map(async ({ id, auth0Id, email }) => {
    try {
      const workosUser = (await getWorkos().userManagement.listUsers({ email }))?.data?.[0];
      if (!workosUser) {
        throw new Error(`User ${email} not found in Workos`);
      }

      usersById[id] = {
        id,
        auth0Id,
        email: workosUser.email,
        name: `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim(),
        firstName: workosUser.firstName ?? undefined,
        lastName: workosUser.lastName ?? undefined,
        picture: workosUser.profilePictureUrl ?? undefined,
      };
    } catch (error) {
      // if user is not found, log the error
      logger.error('Error in getUsersFromWorkos', error, { email, auth0Id });
      Sentry.captureException({
        message: 'Failed to retrieve users from Workos',
        level: 'error',
        extra: {
          email,
          auth0Id,
          workosError: error,
        },
      });

      // and throw an error back to exit from the request
      throw new Error('Failed to retrieve all users from Workos');
    }
  });

  await Promise.all(promises);

  return usersById;
};

// JWT configuration for validating AuthKit access tokens via JWKS
export const jwtConfigWorkos = {
  secret: JwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: JWKS_URI,
  }) as GetVerificationKey,
  algorithms: ['RS256'] as Algorithm[],
};
