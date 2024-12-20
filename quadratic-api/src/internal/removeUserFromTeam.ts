import dbClient from '../dbClient';
import { licenseClient } from '../licenseClient';

export const removeUserFromTeam = async (userId: number, teamId: number) => {
  await dbClient.$transaction(async (prisma) => {
    // Remove user from team
    await prisma.userTeamRole.deleteMany({
      where: {
        userId,
        teamId,
      },
    });

    // Remove user as owner of any files in the team
    // This turns all their "private" team files to "public" ones
    await prisma.file.updateMany({
      where: {
        ownerUserId: userId,
        ownerTeamId: teamId,
      },
      data: {
        ownerUserId: null,
      },
    });
  });

  // update user count in the license server
  await licenseClient.check(true);

  // Update the seat quantity on the team's stripe subscription
  // await updateSeatQuantity(teamId);
};
