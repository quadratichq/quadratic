import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let COMMIT = process.argv.includes('--commit');

main();

async function main() {
  if (!COMMIT) console.log('⚠️ This is a dry run ⚠️\n');

  /**
   *
   * Select all teams that are not activated and do the necessary
   * transactions to delete them
   *
   */
  console.log('Deleting unactivated teams...');
  const teams = await prisma.team.findMany({
    where: { activated: false },
  });

  if (teams.length > 0) {
    for (const team of teams) {
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
   *   1) Make sure they have a team (if not create one)
   *   2) Move all files they own to a team
   *
   */
  console.log('Migrating users to teams...');
  const users = await prisma.user.findMany(); // TODO: select users who have files they own
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
            name: 'Personal',
            UserTeamRole: {
              create: [
                {
                  userId: user.id,
                  role: 'OWNER',
                },
              ],
            },
            // TODO: remove these
            stripeCustomerId: 'foo',
            activated: true,
          },
        });
        oldestTeamId = team.id;
      }
    } else {
      oldestTeamId = userTeamRoles[0].teamId;
      console.log(`  User ${user.id}: ${userTeamRoles.length} teams`);
    }

    // Select all files the user owns
    const files = await prisma.file.findMany({
      where: { ownerUserId: user.id },
    });

    // Iterate through every file the user owns and move it to the oldest team as a draft
    for (const file of files) {
      // Remove the user as owner and set the team as owner
      console.log(`    File ${file.id}: moving to team ${oldestTeamId}`);
      if (COMMIT) {
        await prisma.file.update({
          where: { id: file.id },
          data: {
            // ownerUserId: null,
            // leave ownerUserId as that means it's the user's draft in this team
            ownerTeamId: oldestTeamId,
          },
        });
      }
    }
  }
}
