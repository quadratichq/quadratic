import type { Connection, SyncedConnection } from '@prisma/client';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { connectionDemo } from '../data/connections';

export function getTeamConnectionsList({
  dbConnections,
  settingShowConnectionDemo,
}: {
  dbConnections: (Connection & {
    SyncedConnection: Pick<SyncedConnection, 'percentCompleted' | 'updatedDate'> | null;
  })[];
  settingShowConnectionDemo: boolean;
}): ConnectionList {
  const connections = dbConnections.map((connection) => ({
    uuid: connection.uuid,
    name: connection.name,
    createdDate: connection.createdDate.toISOString(),
    type: connection.type,
    semanticDescription: connection.semanticDescription || undefined,
    isDemo: false,
    syncedConnectionPercentCompleted: connection.SyncedConnection?.percentCompleted ?? 0,
    syncedConnectionUpdatedDate:
      connection.SyncedConnection?.updatedDate?.toISOString() ?? connection.createdDate.toISOString(),
  }));

  if (connectionDemo && settingShowConnectionDemo) {
    connections.push({
      uuid: connectionDemo.uuid,
      name: connectionDemo.name,
      createdDate: connectionDemo.createdDate,
      type: connectionDemo.type,
      semanticDescription: connectionDemo.semanticDescription || undefined,
      isDemo: true,
      syncedConnectionPercentCompleted: 0,
      syncedConnectionUpdatedDate: connectionDemo.createdDate,
    });
  }

  return connections;
}
