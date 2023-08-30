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

export const getUserProfile = async (user_id: number) => {
  const user = await dbClient.user.findUnique({
    where: { id: user_id },
  });

  const auth0_user = await auth0.getUser({ id: user.auth0_id });

  return {
    name: auth0_user.name,
    picture: auth0_user.picture,
    email: auth0_user.email,
  };
};
