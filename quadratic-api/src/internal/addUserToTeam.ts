import type { TeamRole } from '@prisma/client';
import dbClient from '../dbClient';
import { licenseClient } from '../licenseClient';

export const addUserToTeam = async (args: { userId: number; teamId: number; role: TeamRole }) => {
  const { userId, teamId, role } = args;

  // Add user to team
  const userTeamRole = await dbClient.userTeamRole.create({
    data: {
      userId,
      teamId,
      role,
    },
  });

  // update user count in the license server
  await licenseClient.check(true);

  // Update the seat quantity on the team's stripe subscription
  // await updateSeatQuantity(teamId);

  return userTeamRole;
};
