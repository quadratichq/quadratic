import type { ConnectionType, SyncedConnection, SyncedConnectionLog } from '@prisma/client';
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
    throw new ApiError(404, `Connection ${connectionId} not found`);
  }

  return {
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    teamId: connection.team.uuid,
    typeDetails: JSON.parse(decryptFromEnv(Buffer.from(connection.typeDetails).toString('utf-8'))),
  };
}

export async function getConnectionBySyncedConnectionId(syncedConnectionId: number): Promise<ConnectionResponse[0]> {
  const syncedConnection = await dbClient.syncedConnection.findUnique({ where: { id: syncedConnectionId } });
  if (!syncedConnection) {
    throw new ApiError(404, `Synced connection ${syncedConnectionId} not found`);
  }

  return await getConnection(syncedConnection.connectionId);
}
/*
 ===============================
  Synced Connections
 ===============================
*/

export type SyncedConnectionResponse = ApiTypes['/v0/synced-connection/:syncedConnectionId.GET.response'];

// Convert a database result to a response object
export function resultToSyncedConnectionResponse(result: SyncedConnection): SyncedConnectionResponse {
  return {
    ...result,
    updatedDate: result.updatedDate.toISOString(),
  };
}

// Create a new synced connection
export async function createSyncedConnection(data: { connectionId: number }): Promise<SyncedConnectionResponse> {
  const result = await dbClient.syncedConnection.create({
    data: {
      connectionId: data.connectionId,
      status: 'ACTIVE',
    },
  });

  return resultToSyncedConnectionResponse(result);
}

// Update a scheduled task
export async function updateSyncedConnection(data: {
  syncedConnectionId: number;
  percentCompleted: number;
}): Promise<SyncedConnectionResponse> {
  const result = await dbClient.syncedConnection.update({
    where: { id: data.syncedConnectionId },
    data: {
      percentCompleted: data.percentCompleted,
      updatedDate: new Date(),
    },
  });

  return resultToSyncedConnectionResponse(result);
}

// Update the status of a scheduled task
export async function updateSyncedConnectionStatus(
  syncedConnectionId: number,
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED'
): Promise<void> {
  await dbClient.syncedConnection.update({
    where: { id: syncedConnectionId },
    data: { status },
  });
}

// Get a synced connection
export async function getSyncedConnection(syncedConnectionId: number): Promise<SyncedConnectionResponse> {
  const result = await dbClient.syncedConnection.findUnique({ where: { id: syncedConnectionId } });

  if (!result) {
    throw new ApiError(404, `Synced connection ${syncedConnectionId} not found`);
  }

  return resultToSyncedConnectionResponse(result);
}

/*
 ===============================
  Synced Connection Logs
 ===============================
*/

type SyncedConnectionLogResponse = ApiTypes['/v0/teams/:uuid/connections/:connectionUuid/log.GET.response'][number];

export function resultToSyncedConnectionLogResponse(result: SyncedConnectionLog): SyncedConnectionLogResponse {
  return {
    id: result.id,
    syncedConnectionId: result.syncedConnectionId,
    runId: result.runId,
    // combine adjacent dates
    syncedDates: combineAdjacentDateRanges(result.syncedDates.map((date) => date.toISOString().split('T')[0])),
    status: result.status,
    error: result.error || undefined,
    createdDate: result.createdDate.toISOString(),
  };
}

// Create a scheduled task log
export async function createSyncedConnectionLog(data: {
  syncedConnectionId: number;
  runId: string;
  syncedDates: string[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}): Promise<SyncedConnectionLogResponse> {
  const result = await dbClient.syncedConnectionLog.create({
    data: {
      ...data,
      syncedDates: data.syncedDates.map((date) => new Date(date)),
    },
  });

  // add the percent completed
  await addPercentCompleted(data.syncedConnectionId, true);

  return resultToSyncedConnectionLogResponse(result);
}

export async function addPercentCompleted(
  syncedConnectionId: number,
  bypassIfCompleted: boolean = false
): Promise<void> {
  // avoid the extra lookups if the synced connection is already completed
  // and just update the updated date
  if (bypassIfCompleted) {
    const syncedConnection = await getSyncedConnection(syncedConnectionId);
    if (syncedConnection.percentCompleted >= 100) {
      await dbClient.syncedConnection.update({
        where: { id: syncedConnectionId },
        data: { updatedDate: new Date() },
      });

      return;
    }
  }

  const connection = await getConnectionBySyncedConnectionId(syncedConnectionId);
  const percentCompleted = await calculatePercentCompleted(syncedConnectionId, connection.typeDetails.start_date);

  if (percentCompleted === undefined) {
    return;
  }

  await dbClient.syncedConnection.update({
    where: { id: syncedConnectionId },
    data: { percentCompleted, updatedDate: new Date() },
  });
}

// Calculate the percent completed for a synced connection
export async function calculatePercentCompleted(
  syncedConnectionId: number,
  startDate: Date | string
): Promise<number | undefined> {
  const syncedDates = (await getUniqueSyncedDates(syncedConnectionId)).length;
  const endDate = new Date();
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const totalDates = daysBetween(start, endDate) + 1; // range inclusive

  if (totalDates === 0) {
    return undefined;
  }

  const percentCompleted = (syncedDates / totalDates) * 100;

  return Math.min(percentCompleted, 100);
}

// Get a unique array of synced dates
export async function getUniqueSyncedDates(syncedConnectionId: number): Promise<string[]> {
  const result = await dbClient.syncedConnectionLog.findMany({
    where: { syncedConnectionId },
    select: { syncedDates: true },
  });

  return Array.from(new Set(result.flatMap((log) => log.syncedDates.map((date) => date.toISOString().split('T')[0]))));
}

// Get scheduled task logs
// Returns the most recent log entry for each distinct run_id, with pagination support
export async function getSyncedConnectionLogs(
  connectionUuid: string,
  limit: number = 10,
  page: number = 1
): Promise<SyncedConnectionLogResponse[]> {
  const offset = (page - 1) * limit;

  const result = await dbClient.$queryRaw<Array<SyncedConnectionLog>>`
    SELECT * FROM (
      SELECT DISTINCT ON (stl.run_id)
        stl.id,
        stl.synced_connection_id as "syncedConnectionId",
        stl.run_id as "runId",
        stl.synced_dates as "syncedDates",
        stl.status,
        stl.error,
        stl.created_date as "createdDate"
      FROM 
        "SyncedConnectionLog" stl
      INNER JOIN "SyncedConnection" sc ON stl.synced_connection_id = sc.id
      INNER JOIN "Connection" c ON sc.connection_id = c.id
      WHERE
        c.uuid = ${connectionUuid}
      ORDER BY 
        stl.run_id, stl.created_date DESC
    ) subquery
    ORDER BY "createdDate" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return result.map((row) => resultToSyncedConnectionLogResponse(row));
}

// Get a synced connection log
export async function getSyncedConnectionLog(syncedConnectionLogId: number): Promise<SyncedConnectionLogResponse> {
  const result = await dbClient.syncedConnectionLog.findUnique({ where: { id: syncedConnectionLogId } });

  if (!result) {
    throw new ApiError(404, `Synced connection log ${syncedConnectionLogId} not found`);
  }

  return resultToSyncedConnectionLogResponse(result);
}

/*
 ===============================
  Utils
 ===============================
*/
// Given a list of dates, combine adjacent dates into ranges
// Input: ['2025-01-01', '2025-01-02', '2025-01-04']
// Output: ['2025-01-01 to 2025-01-02', '2025-01-04']
export function combineAdjacentDateRanges(dates: string[]): string[] {
  if (dates.length === 0) return [];

  const sortedDates = [...dates].sort();
  const ranges: string[] = [];
  let rangeStart = sortedDates[0];
  let rangeEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i - 1]);
    const diffDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      // Adjacent date, extend the range
      rangeEnd = sortedDates[i];
    } else {
      // Non-adjacent, save the current range and start a new one
      ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} to ${rangeEnd}`);
      rangeStart = sortedDates[i];
      rangeEnd = sortedDates[i];
    }
  }

  // Add the final range
  ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} to ${rangeEnd}`);

  return ranges;
}

// Get the number of days between two dates
export function daysBetween(startDate: Date, endDate: Date): number {
  // Calculate the time difference in milliseconds
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());

  // Convert milliseconds to days
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}
