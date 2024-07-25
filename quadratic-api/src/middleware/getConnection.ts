import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getTeam } from './getTeam';

export async function getConnection({ uuid, userId }: { uuid: string; userId: number }) {
  // Try to find the connection
  const connection = await dbClient.connection.findUnique({
    where: {
      uuid,
    },
    include: {
      team: { select: { uuid: true } },
    },
  });
  if (!connection || connection.archived !== null) {
    throw new ApiError(404, 'Connection not found');
  }

  // Make sure they have access to the connection via the team
  const team = await getTeam({ uuid: connection.team.uuid, userId });
  if (!team.userMakingRequest.permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'You don’t have access to this connection');
  }

  return { connection, team };
}
