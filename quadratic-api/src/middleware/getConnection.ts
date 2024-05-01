import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';

export async function getConnection({ uuid, userId }: { uuid: string; userId: number }) {
  const connection = await dbClient.connection.findUnique({
    where: {
      uuid,
    },
    include: {
      UserConnectionRole: true,
    },
  });
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  if (connection.UserConnectionRole.some((u) => u.userId !== userId)) {
    throw new ApiError(403, 'User does not have access to this connection');
  }
  return connection;
}
