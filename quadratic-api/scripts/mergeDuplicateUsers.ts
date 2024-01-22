import { ManagementClient } from 'auth0';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope: 'read:users',
});

async function getUsersPage(page: number) {
  return await auth0.getUsers({
    per_page: 100,
    page,
  });
}

async function mergeDuplicateUsers() {
  // Go though users in the Prisma database
  // For each user, check if there is another user with the same email in Auth0
  // If so, merge the two users in Auth0
  // Then copy the files to the primary user in Prisma
  // Then delete the secondary user in Prisma
  // If not, do nothing
}

mergeDuplicateUsers().catch((error) => {
  console.error('Error listing users:', error);
});
