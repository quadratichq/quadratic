import dbClient from '../dbClient';
import { updateSeatQuantity } from '../stripe/stripe';

export const removeUserFromTeam = async (userId: number, teamId: number) => {
  await dbClient.userTeamRole.delete({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  // Update the seat quantity on the team's stripe subscription
  await updateSeatQuantity(teamId);
};
