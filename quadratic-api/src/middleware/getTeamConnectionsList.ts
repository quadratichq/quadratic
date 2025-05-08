import type { Connection } from '@prisma/client';
import { demoConnectionCondensed } from '../data/connections';

export function getTeamConnectionsList({
  dbConnections,
  settingShowDemoConnection,
}: {
  dbConnections: Connection[];
  settingShowDemoConnection: boolean;
}) {
  const connections = dbConnections.map((connection) => ({
    uuid: connection.uuid,
    name: connection.name,
    createdDate: connection.createdDate.toISOString(),
    type: connection.type,
  }));
  if (settingShowDemoConnection) {
    connections.push(demoConnectionCondensed);
  }
  return connections;
}
