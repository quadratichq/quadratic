import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getTeam } from './getTeam';

/**
 * Used to get a connection in a specific team.
 */
export async function getTeamConnection({
  connectionUuid,
  teamUuid,
  userId,
}: {
  connectionUuid: string;
  teamUuid: string;
  userId: number;
}) {
  // Find the connection
  const connection = await dbClient.connection.findUnique({
    where: {
      uuid: connectionUuid,
    },
    include: {
      team: { select: { uuid: true } },
      SyncedConnection: { select: { percentCompleted: true, updatedDate: true } },
    },
  });
  if (!connection || connection.archived !== null) {
    throw new ApiError(404, 'Connection not found');
  }

  // Make sure the connection lives in the specified team
  //
  // Note: connections always live in the context of a team, therefore a user
  // with access to connections across multiple teams should still only be able
  // to see the connections that live in the specified team. Example:
  //
  // - Connection 'Foo' lives in Team1
  // - Connection 'Bar' lives in Team2
  // - User 'John' has access to Team1 and Team2
  // - User 'John' should not be able to run connection 'Foo' from a file in Team2
  //
  // In that case, the connection is not found as it doesn't exist in the
  // context of the specified team.
  if (connection.team.uuid !== teamUuid) {
    throw new ApiError(404, 'Connection not found');
  }

  // Make sure the user has access to the connection _via the specified team_
  const team = await getTeam({ uuid: teamUuid, userId });
  if (!team.userMakingRequest.permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'You don’t have access to this connection');
  }

  return { connection, team, syncedConnection: connection.SyncedConnection };
}
