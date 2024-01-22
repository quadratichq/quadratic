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
        auth0Id: {
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
    const primary_user = db_users.find((user) => user.auth0Id.includes('google-oauth2|'));
    const secondary_user = db_users.find((user) => user.auth0Id.includes('auth0|'));

    console.log(`Merging users ${primary_user} and ${secondary_user}`);

    if (!commit) {
      console.log('Skip: dry run');
      continue;
    }

    // Link the secondary user to the primary user in Auth0
    auth0.linkUsers(primary_user.auth0Id, {
      user_id: secondary_user.auth0Id,
    });

    // Then copy the files to the primary user in Prisma
    dbClient.file.updateMany({
      where: {
        id: secondary_user.id,
      },
      data: {
        id: primary_user.id,
      },
    });

    // Then copy the feedback to the primary user in Prisma
    dbClient.qFeedback.updateMany({
      where: {
        id: secondary_user.id,
      },
      data: {
        id: primary_user.id,
      },
    });

    // Then delete the secondary user in Prisma
    dbClient.user.delete({
      where: {
        id: secondary_user.id,
      },
    });

    console.log(`Merged users ${primary_user} and ${secondary_user}`);
  }
  console.log('Done');
}

mergeDuplicateUsers().catch((error) => {
  console.error('Error listing users:', error);
});
