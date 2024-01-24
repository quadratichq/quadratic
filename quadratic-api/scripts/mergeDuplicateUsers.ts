import { ManagementClient } from 'auth0';
import dbClient from '../src/dbClient';
import { getDuplicateUsers } from './getDuplicateUsers';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope: 'read:users',
});

const commit = false;

async function mergeDuplicateUsers() {
  // Get duplicate emails
  const duplicate_users = await getDuplicateUsers();
  console.log(`Processing ${duplicate_users.size} duplicate users.`);
  // Loop through duplicate emails,
  for (const [email, users] of duplicate_users) {
    console.log(`Processing users with email ${email}`);
    const db_users = await dbClient.user.findMany({
      where: {
        auth0_id: {
          in: users.map((user) => user.user_id),
        },
      },
    });

    // verify that both users are in the DB
    if (db_users.length !== 2) {
      console.log('Skip: user is not a duplicate in the DB.');
      continue;
    }

    // Assign the google user as the primary user
    const primary_user = db_users.find((user) => user.auth0_id.includes('auth0|'));
    const secondary_user = db_users.find((user) => user.auth0_id.includes('google-oauth2|'));

    console.log(`Merging users ${primary_user.auth0_id} and ${secondary_user.auth0_id}`);

    if (!commit) {
      console.log('Skip: dry run');
      continue;
    }

    // Link the secondary user to the primary user in Auth0
    auth0.linkUsers(primary_user.auth0_id, {
      user_id: secondary_user.auth0_id,
      provider: 'google-oauth2',
    });

    // Then copy the files to the primary user in Prisma
    await dbClient.file.updateMany({
      where: {
        ownerUserId: secondary_user.id,
      },
      data: {
        ownerUserId: primary_user.id,
      },
    });

    // Then copy the feedback to the primary user in Prisma
    await dbClient.qFeedback.updateMany({
      where: {
        userId: secondary_user.id,
      },
      data: {
        userId: primary_user.id,
      },
    });

    // Then delete the secondary user in Prisma
    await dbClient.user.delete({
      where: {
        id: secondary_user.id,
      },
    });

    console.log(`Merged users ${primary_user.auth0_id} and ${secondary_user.auth0_id}`);
  }
  console.log('Done');
}

mergeDuplicateUsers().catch((error) => {
  console.error('Error listing users:', error);
});
