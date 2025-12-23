import type { ConnectionType } from '@prisma/client';
import { ConnectionType as ConnectionTypeEnum } from '@prisma/client';
import { query } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';
import { ApiError } from './ApiError';
import { decryptFromEnv } from './crypto';

export const validateType = () => query('type').isString().isIn(Object.values(ConnectionTypeEnum));

/*
 ===============================
  Connections
 ===============================
*/

type ConnectionResponse = ApiTypes['/v0/internal/connection.GET.response'];

export async function getConnections(type: ConnectionTypeEnum): Promise<ConnectionResponse> {
  const connections = await dbClient.connection.findMany({
    where: {
      type: type as ConnectionType,
      archived: null,
    },
    include: {
      team: { select: { uuid: true } },
    },
  });

  return connections.map((connection) => ({
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    teamId: connection.team.uuid,
    typeDetails: JSON.parse(decryptFromEnv(Buffer.from(connection.typeDetails).toString('utf-8'))),
  }));
}

export async function getConnection(connectionId: number): Promise<ConnectionResponse[0]> {
  const connection = await dbClient.connection.findUnique({
    where: {
      id: connectionId,
      archived: null,
    },
    include: {
      team: { select: { uuid: true } },
    },
  });

  if (!connection) {
    throw new ApiError(500, `Connection ${connectionId} not found`);
  }

  return {
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    teamId: connection.team.uuid,
    typeDetails: JSON.parse(decryptFromEnv(Buffer.from(connection.typeDetails).toString('utf-8'))),
  };
}
