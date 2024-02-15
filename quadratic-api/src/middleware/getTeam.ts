import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getTeamPermissions } from '../utils/permissions';

/**
 * Takes the team's `uuid` and the `id` of the user making the request.
 *
 * Ensures that the team exists and the user has access to it. Then it attaches
 * data to the request about the team and the user's relationship to the team
 */
export async function getTeam({ uuid, userId }: { uuid: string; userId: number }) {
  // Lookup the team
  const team = await dbClient.team.findUnique({
    where: {
      uuid,
    },
  });
  if (team === null) {
    throw new ApiError(404, 'Team not found');
  }

  // Check if the user making the request has access to the team
  const userTeamRole = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
  });
  if (userTeamRole === null) {
    throw new ApiError(404, 'Team not found');
  }

  // TODO: future - if the team is deleted/archived

  // Create info about the user making the request
  const userMakingRequest = { id: userId, permissions: getTeamPermissions(userTeamRole.role), role: userTeamRole.role };

  return { team, userMakingRequest };
}
