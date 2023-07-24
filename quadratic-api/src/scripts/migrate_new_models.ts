import dbClient from '../../src/dbClient';

// July 2023 used to move from QUser and File to User and File models
export const migrateFiles = async () => {
  const old_users = await dbClient.qUser.findMany();

  // Create new users from old users
  for (const old_user of old_users) {
    const new_user = await dbClient.user.create({
      data: {
        auth0_id: old_user.auth0_user_id,
      },
    });
    console.log(`Created new user ${new_user.id} from old user ${old_user.id}: ${old_user.auth0_user_id}`);
  }

  const old_files = await dbClient.qFile.findMany();

  // Create new files from old files
  for (const old_file of old_files) {
    const new_file = await dbClient.file.create({
      data: {
        // Set owner correctly to new user id
        name: old_file.name,
        contents: Buffer.from(JSON.stringify(old_file.contents)),
      },
    });
    console.log(`Created new file ${new_file.id} from old file ${old_file.id}: ${old_file.name}`);
  }
};
