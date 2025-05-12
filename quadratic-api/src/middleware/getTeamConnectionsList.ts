import type { Connection } from '@prisma/client';
import { demoConnectionCondensed } from '../data/connections';

export function getTeamConnectionsList({ dbConnections }: { dbConnections: Connection[] }) {
  const connections = dbConnections.map((connection) => ({
    uuid: connection.uuid,
    name: connection.name,
    createdDate: connection.createdDate.toISOString(),
    type: connection.type,
  }));

  connections.push(demoConnectionCondensed);

  return connections;
}
