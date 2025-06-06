import type { Connection } from '@prisma/client';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { connectionDemo } from '../data/connections';

export function getTeamConnectionsList({
  dbConnections,
  settingShowConnectionDemo,
}: {
  dbConnections: Connection[];
  settingShowConnectionDemo: boolean;
}): ConnectionList {
  const connections = dbConnections.map((connection) => ({
    uuid: connection.uuid,
    name: connection.name,
    createdDate: connection.createdDate.toISOString(),
    type: connection.type,
    isDemo: false,
  }));

  if (connectionDemo && settingShowConnectionDemo) {
    connections.push({
      uuid: connectionDemo.uuid,
      name: connectionDemo.name,
      createdDate: connectionDemo.createdDate,
      type: connectionDemo.type,
      isDemo: true,
    });
  }

  return connections;
}
