import { TeamRole } from '@prisma/client';
import dbClient from '../dbClient';
import { updateSeatQuantity } from '../stripe/stripe';

export const addUserToTeam = async (userId: number, teamId: number, role: TeamRole) => {
  // Add user to team
  const userTeamRole = await dbClient.userTeamRole.create({
    data: {
      userId,
      teamId,
      role,
    },
  });

  // Update the seat quantity on the team's stripe subscription
  await updateSeatQuantity(teamId);

  // TODO: send them an email

  return userTeamRole;
};
