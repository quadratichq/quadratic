import type { Connection } from '@prisma/client';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { connectionDemoCondensed } from '../data/connections';

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
  }));

  const demo: ConnectionList[number] = {
    ...connectionDemoCondensed,
    isDemoVisible: settingShowConnectionDemo,
  };
  connections.push(demo);

  return connections;
}
