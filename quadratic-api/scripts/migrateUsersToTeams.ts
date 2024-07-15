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
   * Additionally: this script SHOULD run first, as we don't want to migrate files
   * to a team that was not activated.
   *
   * NOTE:
   * After this migration, every team should be `activated === null`
   * so we should remove `activated` from the schema in a later commit.
   *
   */
  console.log('Cleaning up unactivated teams:');
  const unactivatedTeams = await prisma.team.findMany({
    where: { activated: false },
    select: { id: true, UserTeamRole: true },
  });

  if (unactivatedTeams.length > 0) {
    for (const team of unactivatedTeams) {
      try {
        if (COMMIT) {
          await prisma.$transaction(async (prisma) => {
            // Delete all user roles associated with this team
            await prisma.userTeamRole.deleteMany({
              where: { teamId: team.id },
            });

            // Delete the team
            await prisma.team.delete({
              where: { id: team.id },
            });
          });
        }

        console.log('  Team %s: deleted team and %s role(s)', team.id, team.UserTeamRole.length);
      } catch (e) {
        console.error('  Team %s: failed to delete team and roles', team.id);
        console.error(e);
      }
    }
  }

  /**
   *
   * Iterate through all users and:
   *   1) Make sure they have a team (if they don't, create one)
   *   2) Move all files they own to a team
   *
   */
  console.log('Migrating users to teams:');

  // In "old" schema we're working against, a File would have an `ownerTeamId`
  // or `ownerUserId` to represent that the file belongs to a team OR a user
  // but never both.
  //
  // So we want to select all users who own files and process them
  const users = await prisma.user.findMany({
    where: {
      ownedFiles: {
        some: {
          // If we have to run this script again, we want to make sure we're selecting
          // files that haven't been moved yet.
          ownerUserId: { not: null },
          ownerTeamId: null,
        },
      },
    },
    select: {
      id: true,
      ownedFiles: true,
      UserTeamRole: true,
    },
  });

  // Loop through every user and move their files to a team
  for (const user of users) {
    // Get all teams the user belongs to
    const userTeamRoles = user.UserTeamRole;
    let oldestTeamId = userTeamRoles.length === 0 ? undefined : userTeamRoles[0].teamId;
    let createdNewTeam = false;

    // If they don't have a team, create one
    if (userTeamRoles.length === 0) {
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
            // Must set this to activated so we don't delete later if we have to run this script again
            activated: true,
            // TODO: expects `stripeCustomerId` but not required in new schema
            // so we should leave this out of the script
            stripeCustomerId: String(Date.now()),
          },
        });
        oldestTeamId = team.id;
      }
      createdNewTeam = true;
    }

    // Move all the user's personal files to a team they belong to
    try {
      let updatedFilesCount = 0;
      if (COMMIT) {
        const updatedFiles = await prisma.file.updateMany({
          where: {
            ownerUserId: user.id,
          },
          data: {
            // TODO: should the file remain private on the team, or public?
            // If it's private, that means when the user logs in next they won't see their files!
            // If it's public, that means they'll see them when they login but anyone who joins the team will see them too.
            ownerUserId: null, // OR: leave `ownerUserId` as it is, which means its a private file on the team
            ownerTeamId: oldestTeamId,
          },
        });
        updatedFilesCount = updatedFiles.count;
      } else {
        updatedFilesCount = user.ownedFiles.length;
      }

      console.log(
        '  User %s: moved %s file(s) to %s team',
        user.id,
        updatedFilesCount,
        createdNewTeam ? 'NEW' : 'EXISITING'
      );
    } catch (e) {
      console.log('  User %s: failed to move file(s)', user.id);
    }
  }
}
