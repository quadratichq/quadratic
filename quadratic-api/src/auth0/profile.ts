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

export const getAuth0User = async (auth0_id: string) => {
  const user = await auth0.getUser({ id: auth0_id });

  //   user.picture = await fetchImageAndEncode(user.picture);
  return user;
};

export const getUserProfile = async (id: number) => {
  const user = await dbClient.user.findUnique({
    where: { id },
  });

  const auth0_user = await getAuth0User(user.auth0_id);

  const name = user.name ?? auth0_user.name ?? undefined;
  const picture = user.picture ?? auth0_user.picture ?? undefined;

  console.log('name', name);
  console.log('picture', picture);

  return {
    name,
    picture,
    email: auth0_user.email,
  };
};
