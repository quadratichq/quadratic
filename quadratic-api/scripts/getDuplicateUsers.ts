import { AppMetadata, ManagementClient, User, UserMetadata } from 'auth0';

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

export const getDuplicateUsers = async () => {
  const seen_users = new Map<string, User<AppMetadata, UserMetadata>>();
  const duplicate_users = new Map<string, User<AppMetadata, UserMetadata>[]>();

  let page = 0;
  let users = await getUsersPage(page);
  while (users.length > 0) {
    users.forEach((user) => {
      if (user.email === undefined) {
        return;
      }

      // If we've seen this email before
      if (seen_users.has(user.email)) {
        console.log(`Duplicate email: ${user.email}`);

        // If we haven't already
        if (!duplicate_users.has(user.email)) {
          // Add the first user to the duplicate list
          duplicate_users.set(user.email, [seen_users.get(user.email)]);
        }

        // Add this user to the duplicate list
        duplicate_users.get(user.email)?.push(user);
      }

      seen_users.set(user.email, user);
    });
    page += 1;
    users = await getUsersPage(page);
  }

  return duplicate_users;
};
