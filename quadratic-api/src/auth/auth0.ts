import * as Sentry from '@sentry/node';
import { ManagementClient } from 'auth0';
import type { Algorithm } from 'jsonwebtoken';
import type { GetVerificationKey } from 'jwks-rsa';
import jwksRsa from 'jwks-rsa';
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_DOMAIN,
  AUTH0_ISSUER,
  AUTH0_JWKS_URI,
} from '../env-vars';
import type { ByEmailUser, User } from './auth';

// Guide to Setting up on Auth0
// 1. Create an Auth0 Machine to Machine Application
// 2. Check that Grant Types include Client Credentials
// 3. Check that APIs include Auth0 Management API
// 4. Check that APIs Auth0 Management API Scopes (via dropdown) include read:users

// We need to use account linking to ensure only one account per user
// https://auth0.com/docs/customize/extensions/account-link-extension

let auth0: ManagementClient | undefined;
const getAuth0 = () => {
  if (!auth0) {
    auth0 = new ManagementClient({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      clientSecret: AUTH0_CLIENT_SECRET,
      scope: 'read:users',
    });
  }
  return auth0;
};

/**
 * Given a list of users from our system, we lookup their info in Auth0.
 * If we don't find a user, we throw.
 *
 * Example in:
 *   [
 *     { id: 10, auth0Id: 'google-oauth2|112233', ... }
 *   ]
 * Example out:
 *   {
 *     10: {
 *       id: 10,
 *       auth0Id: 'google-oauth2|112233',
 *       email: 'john_doe@example.com',
 *       name: 'John Doe',
 *       picture: 'https://example.com/picture.jpg'
 *     }
 *   }
 */
export const getUsersFromAuth0 = async (users: { id: number; auth0Id: string }[]): Promise<Record<number, User>> => {
  // If we got nothing, we return an empty object
  if (users.length === 0) {
    return {};
  }

  // Search for users on Auth0
  const auth0Ids = users.map(({ auth0Id }) => auth0Id);
  const auth0Users = await getAuth0().getUsers({
    q: `user_id:(${auth0Ids.join(' OR ')})`,
  });

  // Index search results by user_id for quick lookup
  const auth0UserMap = new Map(auth0Users.map((u) => [u.user_id, u]));

  // Map the users we found by their Quadratic ID
  const usersById: Record<number, User> = {};

  const promises = users.map(async ({ id, auth0Id }) => {
    let auth0User = auth0UserMap.get(auth0Id);

    // If missing or incomplete, fallback to direct lookup
    if (!auth0User || !auth0User.email) {
      console.log(JSON.stringify({ message: 'Fallback to direct lookup for', auth0Id }));
      try {
        auth0User = await getAuth0().getUser({ id: auth0Id });
      } catch (err) {
        Sentry.captureException(err, {
          level: 'error',
          extra: {
            context: 'Failed fallback Auth0 user lookup',
            auth0Id,
          },
        });
      }
    }

    // If we're missing data we expect, log it to Sentry and throw
    if (!auth0User || !auth0User.email) {
      console.log(JSON.stringify({ message: 'Failed to retrieve all user info from Auth0', auth0Id }));
      Sentry.captureException({
        message: 'Auth0 user returned without `email`',
        level: 'error',
        extra: {
          auth0IdInOurDb: auth0Id,
          auth0UserResult: auth0User,
        },
      });
      throw new Error('Failed to retrieve all user info from Auth0');
    }

    // Add the user
    usersById[id] = {
      id,
      auth0Id,
      email: auth0User.email,
      name: auth0User.name,
      picture: auth0User.picture,
    };
  });

  await Promise.all(promises);

  return usersById;
};

export const getUsersFromAuth0ByEmail = async (email: string): Promise<ByEmailUser[]> => {
  const auth0Users = await getAuth0().getUsersByEmail(email);
  return auth0Users;
};

export const jwtConfigAuth0 = {
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: AUTH0_JWKS_URI,
  }) as GetVerificationKey,
  audience: AUTH0_AUDIENCE,
  issuer: AUTH0_ISSUER,
  algorithms: ['RS256'] as Algorithm[],
};
