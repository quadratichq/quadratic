import { ManagementClient } from 'auth0';
import dbClient from '../dbClient';

// Guide to Setting up on Auth0
// 1. Create an Auth0 Machine to Machine Application
// 2. Check that Grant Types include Client Credentials
// 3. Check that APIs include Auth0 Management API
// 4. Check that APIs Auth0 Management API Scopes (via dropdown) include read:users

// We need to use account linking to ensure only one account per user
// https://auth0.com/docs/customize/extensions/account-link-extension

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope: 'read:users',
});

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

export const getUserProfile = async (userId: number) => {
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });

  const { name, picture, email } = await auth0.getUser({ id: user.auth0_id });

  return {
    name,
    picture,
    email,
  };
};

export const getUsersByEmail = async (email: string) => {
  const auth0Users = await auth0.getUsersByEmail(email);
  return auth0Users;
};
