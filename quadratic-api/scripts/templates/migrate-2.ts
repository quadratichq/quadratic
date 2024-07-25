import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let COMMIT = process.argv.includes('--commit');

main();

async function main() {
  if (!COMMIT) console.log('⚠️ This is a dry run ⚠️\n');

  /**
   *
   * Iterate through all users who have personal files and:
   *   1) Make sure they have a team (if they don't, create one)
   *   2) Move all files they own to a team
   *
   */

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
    take: 10000, // limit how much happens at a time
  });

  console.log('Found %s user(s) with personal files', users.length);

  // Loop through every user and move their files to a team. Do it all in one
  // transaction so if anything fails, we can retry the whole thing on a user-by-user basis.
  for (const user of users) {
    await prisma.$transaction(async (prisma) => {
      let needToCreateNewTeam = user.UserTeamRole.length === 0;
      let idOfTeamToMoveFilesTo = needToCreateNewTeam
        ? COMMIT
          ? (
              await prisma.team.create({
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
                  // TODO: main expects this, but once we ship its not required.
                  // Must set this to `true` so we don't delete later if we have to run this script again
                  // activated: true,
                  // TODO: expects `stripeCustomerId` but not required in new schema
                  // so we should leave this out of the script
                  // stripeCustomerId: String(Date.now()),
                },
              })
            ).id
          : 0
        : user.UserTeamRole[0].teamId;

      // Move all the user's personal files to a team they belong to
      try {
        if (COMMIT) {
          await prisma.file.updateMany({
            where: {
              ownerUserId: user.id,
              ownerTeamId: null,
            },
            data: {
              // If a new team was created, move the files to being public on the team
              // Otherwise, move the files to being private on the existing team
              ...(needToCreateNewTeam ? { ownerUserId: null } : {}), // leaving `ownerUserId` as it's current value means it'll be a private file to the user on their team
              ownerTeamId: idOfTeamToMoveFilesTo,
            },
          });
        }

        console.log(
          'User %s: moved %s file(s) to %s team',
          user.id,
          user.ownedFiles.length,
          needToCreateNewTeam ? 'NEW' : 'EXISTING'
        );
      } catch (e) {
        console.log('User %s: failed to move file(s)', user.id);
      }
    });
  }
}
