import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let COMMIT = process.argv.includes('--commit');

main();

async function main() {
  if (!COMMIT) console.log('⚠️ --- This is a dry run --- ⚠️\n');

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

        console.log('Team %s: deleted team and %s role(s)', team.id, team.UserTeamRole.length);
      } catch (e) {
        console.error('Team %s: failed to delete team and roles', team.id);
        console.error(e);
      }
    }
  }
}
