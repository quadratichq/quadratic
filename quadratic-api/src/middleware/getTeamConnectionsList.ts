import type { Connection, SyncedConnection, SyncedConnectionLog } from '@prisma/client';
import type { ConnectionList, SyncedConnectionLatestLogStatus } from 'quadratic-shared/typesAndSchemasConnections';
import { connectionDemo } from '../data/connections';

export function getTeamConnectionsList({
  dbConnections,
  settingShowConnectionDemo,
}: {
  dbConnections: (Connection & {
    SyncedConnection:
      | (Pick<SyncedConnection, 'percentCompleted' | 'updatedDate'> & {
          SyncedConnectionLog: Pick<SyncedConnectionLog, 'status' | 'error'>[];
        })
      | null;
  })[];
  settingShowConnectionDemo: boolean;
}): ConnectionList {
  const connections: ConnectionList = dbConnections.map((connection) => {
    const latestLog = connection.SyncedConnection?.SyncedConnectionLog?.[0];
    return {
      uuid: connection.uuid,
      name: connection.name,
      createdDate: connection.createdDate.toISOString(),
      type: connection.type,
      semanticDescription: connection.semanticDescription || undefined,
      isDemo: false,
      syncedConnectionPercentCompleted: connection.SyncedConnection?.percentCompleted,
      syncedConnectionUpdatedDate: connection.SyncedConnection?.updatedDate?.toISOString(),
      syncedConnectionLatestLogStatus: latestLog?.status as SyncedConnectionLatestLogStatus | undefined,
      syncedConnectionLatestLogError: latestLog?.error ?? undefined,
    };
  });

  if (connectionDemo && settingShowConnectionDemo) {
    connections.push({
      uuid: connectionDemo.uuid,
      name: connectionDemo.name,
      createdDate: connectionDemo.createdDate,
      type: connectionDemo.type,
      semanticDescription: connectionDemo.semanticDescription || undefined,
      isDemo: true,
      syncedConnectionPercentCompleted: undefined,
      syncedConnectionUpdatedDate: undefined,
      syncedConnectionLatestLogStatus: undefined,
      syncedConnectionLatestLogError: undefined,
    });
  }

  return connections;
}
