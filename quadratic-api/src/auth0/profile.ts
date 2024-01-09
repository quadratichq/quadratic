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

export const getUserByAuth0Id = async (auth0Id: string) => {
  const user = await auth0.getUser({ id: auth0Id });
  if (!user.email) {
    throw new Error(`User info is incomplete`);
    Sentry.captureException({
      message: 'User is missing email in Auth0',
      level: 'error',
      extra: {
        auth0Id,
      },
    });
  }

  return {
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
};

export const getAuth0Users = async (auth0Ids: string[]) => {
  try {
    const auth0Users = await auth0.getUsers({
      q: `user_id:(${auth0Ids.join(' OR ')})`,
    });
    return auth0Users;
  } catch (e) {
    // TODO log to sentry?
    console.error(e);
    return [];
  }
};

export const getUsersByEmail = async (email: string) => {
  const auth0Users = await auth0.getUsersByEmail(email);
  return auth0Users;
};

/**
 * Given a list of users from in system, we lookup their info in Auth0 and
 * augment it with the auth0 data.
 *
 * If some data is missing from the auth0 query that we expect in our system,
 * that user just gets left out of the result and we log it to Sentry.
 *
 * Example in:
 *   [
 *     { id: 10, auth0Id: 'google-oauth2|112233', ... }
 *   ]
 * Example out:
 *   [
 *     {
 *       id: 10,
 *       auth0Id: 'google-oauth2|112233',
 *       email: 'john_doe@example.com',
 *       name: 'John Doe',
 *       picture: 'https://example.com/picture.jpg'
 *       ...
 *     }
 *   ]
 */
export async function augmentUsersWithAuth0Info<
  T extends {
    // Base user info
    id: number;
    auth0Id: string;
  }
>(
  users: T[]
): Promise<
  (T & {
    // Augmented user info
    email: string;
    name?: string;
    picture?: string;
  })[]
> {
  type UsersByAuth0Id = Record<string, T>;
  const usersByAuth0Id = users.reduce(
    (acc: UsersByAuth0Id, user) => ({ ...acc, [user.auth0Id]: user }),
    {} as UsersByAuth0Id
  );

  // Search for users on Auth0
  const auth0Ids = users.map(({ auth0Id }) => auth0Id);
  const auth0Users = await auth0.getUsers({
    q: `user_id:(${auth0Ids.join(' OR ')})`,
  });

  // If the number of users we tried to lookup doesn't match our results,
  // something is wrong and we better log it to Sentry
  if (auth0Users.length !== users.length) {
    Sentry.captureEvent({
      message: 'Number of users returned from Auth0 does not match number of users sent to Auth0',
      level: 'error',
      extra: {
        userIdsRequested: auth0Ids,
        auth0UserIdsReturned: auth0Users.map(({ user_id }) => user_id),
      },
    });
  }

  // Augment the users with the data we got back from Auth0
  const out = [];
  for (const auth0User of auth0Users) {
    const { email, name, picture, user_id: auth0Id } = auth0User;

    // If we're missing data we expect, log it to Sentry and skip this user
    if (!(auth0Id && email)) {
      Sentry.captureException({
        message: 'Auth0 user returned without `auth0Id` or `email`',
        level: 'error',
        extra: {
          auth0UserReturned: auth0User,
        },
      });
      continue;
    }

    out.push({ ...usersByAuth0Id[auth0Id], email, name, picture });
  }

  return out;
}
