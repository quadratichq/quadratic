import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let COMMIT = process.argv.includes('--commit');

main();

async function main() {
  if (!COMMIT) console.log('⚠️ This is a dry run ⚠️\n');

  /**
   *
   * Select all teams that are not activated and delete them.
   *
   * WHY:
   * Because users who tried to create a team before, but bailed via stripe,
   * are going to have some of these teams lying around. We clean them up so they
   * don't see them when they login.
   *
   * NOTE:
   * After this migration, every team should be `activated === null`
   * so we should remove `activated` from the schema in a later commit.
   *
   */
  console.log('Cleaning up unactivated teams...');
  const unactivatedTeams = await prisma.team.findMany({
    where: { activated: false },
  });

  if (unactivatedTeams.length > 0) {
    console.log('Found %s unactivated teams. Deleting...', unactivatedTeams.length);
    for (const team of unactivatedTeams) {
      // Select all userTeamRoles in this team and delete them
      const userTeamRoles = await prisma.userTeamRole.findMany({
        where: { teamId: team.id },
      });
      console.log(`  Team ${team.id}: deleting ${userTeamRoles.length} roles`);
      for (const userTeamRole of userTeamRoles) {
        if (COMMIT) {
          await prisma.userTeamRole.delete({
            where: { id: userTeamRole.id },
          });
        }
      }

      // Then delete the team
      if (COMMIT) {
        await prisma.team.delete({
          where: { id: team.id },
        });
      }
      console.log(`  Team ${team.id}: deleted`);
    }
  }

  /**
   *
   * Iterate through all users and:
   *   1) Make sure they have a team (if they don't, create one)
   *   2) Move all files they own to a team
   *
   */
  console.log('Migrating users to teams...');

  // In "old" schema we're working against, a File would have an `ownerTeamId`
  // or `ownerUserId` to represent that the file belongs to a team OR a user
  // but never both.
  //
  // So we want to select all users who own files and process them
  const users = await prisma.user.findMany({
    where: {
      ownedFiles: {
        some: {
          ownerUserId: { not: null },
        },
      },
    },
    select: {
      id: true,
      ownedFiles: true,
    },
  });

  // Loop through every user and move their files to a team
  for (const user of users) {
    // Get all teams the user belongs to
    const userTeamRoles = await prisma.userTeamRole.findMany({
      where: { userId: user.id },
    });
    let oldestTeamId: undefined | number = undefined;

    // If they don't have a team, create one
    if (userTeamRoles.length === 0) {
      console.log(`  User ${user.id}: 0 teams, creating one...`);
      if (COMMIT) {
        const team = await prisma.team.create({
          data: {
            name: 'My Team',
            UserTeamRole: {
              create: [
                {
                  userId: user.id,
                  role: 'OWNER',
                },
              ],
            },
          },
        });
        oldestTeamId = team.id;
      }
    } else {
      oldestTeamId = userTeamRoles[0].teamId;
      console.log(`  User ${user.id}: ${userTeamRoles.length} teams`);
    }

    // Iterate through every file the user owns and move it to the oldest team as a draft
    for (const file of user.ownedFiles) {
      // Remove the user as owner and set the team as owner
      console.log(`    File ${file.id}: moving to team ${oldestTeamId}`);
      if (COMMIT) {
        await prisma.file.update({
          where: { id: file.id },
          data: {
            // TODO: should the file remain private on the team, or public?
            // If it's private, that means when the user logs in next they won't see their files!
            // If it's public, that means they'll see them when they login but anyone who joins the team will see them too.

            ownerUserId: null,
            // OR: leave `ownerUserId` as it is, which means its a private file on the team
            ownerTeamId: oldestTeamId,
          },
        });
      }
    }
  }
}
