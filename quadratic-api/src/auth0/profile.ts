import * as Sentry from '@sentry/node';
import { ManagementClient } from 'auth0';

// Guide to Setting up on Auth0
// 1. Create an Auth0 Machine to Machine Application
// 2. Check that Grant Types include Client Credentials
// 3. Check that APIs include Auth0 Management API
// 4. Check that APIs Auth0 Management API Scopes (via dropdown) include read:users

// We need to use account linking to ensure only one account per user
// https://auth0.com/docs/customize/extensions/account-link-extension

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope: 'read:users',
});

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
export const getUsersFromAuth0 = async (users: { id: number; auth0Id: string }[]) => {
  // Search for users on Auth0
  const auth0Ids = users.map(({ auth0Id }) => auth0Id);
  const auth0Users = await auth0.getUsers({
    q: `user_id:(${auth0Ids.join(' OR ')})`,
  });

  // Map users by their Quadratic ID. If we didn't find a user, throw.
  type UsersById = Record<
    number,
    {
      id: number;
      auth0Id: string;
      email: string;
      name?: string;
      picture?: string;
    }
  >;
  const usersById: UsersById = users.reduce((acc: UsersById, { id, auth0Id }) => {
    const auth0User = auth0Users.find(({ user_id }) => user_id === auth0Id);

    // If we're missing data we expect, log it to Sentry and skip this user
    if (!auth0User || auth0User.email === undefined) {
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

    const { email, name, picture } = auth0User;
    return {
      ...acc,
      [id]: {
        id,
        auth0Id,
        email,
        name,
        picture,
      },
    };
  }, {});

  return usersById;
};

export const lookupUsersFromAuth0ByEmail = async (email: string) => {
  const auth0Users = await auth0.getUsersByEmail(email);
  return auth0Users;
};
