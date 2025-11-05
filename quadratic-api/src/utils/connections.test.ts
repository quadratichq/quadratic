import type { Connection, User } from '@prisma/client';
import { ConnectionType } from '@prisma/client';
import dbClient from '../dbClient';
import { clearDb, createConnection, createTeam, createUser } from '../tests/testDataGenerator';
import { ApiError } from './ApiError';
import {
  createSyncedConnection,
  createSyncedConnectionLog,
  getConnection,
  getConnectionBySyncedConnectionId,
  getConnections,
  getSyncedConnection,
  getSyncedConnectionLog,
  getSyncedConnectionLogs,
  getUniqueSyncedDates,
  updateSyncedConnection,
  updateSyncedConnectionStatus,
} from './connections';
import { encryptFromEnv } from './crypto';

let team: Awaited<ReturnType<typeof createTeam>>;
let user: User;
let connection: Connection;

beforeEach(async () => {
  user = await createUser({ auth0Id: 'test-user' });
  team = await createTeam({ users: [{ userId: user.id, role: 'OWNER' }] });
  const typeDetails = JSON.stringify({ host: 'localhost', port: 5432, startDate: new Date('2025-01-01') });
  connection = await createConnection({
    teamId: team.id,
    name: 'Test Connection',
    type: ConnectionType.POSTGRES,
    typeDetails: Buffer.from(encryptFromEnv(typeDetails)),
  });
});

afterEach(clearDb);

describe('getConnections', () => {
  it('should return all non-archived connections of a specific type', async () => {
    const result = await getConnections(ConnectionType.POSTGRES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Connection');
    expect(result[0].type).toBe(ConnectionType.POSTGRES);
    expect(result[0].teamId).toBe(team.uuid);
  });

  it('should return empty array when no connections exist', async () => {
    const result = await getConnections(ConnectionType.MYSQL);
    expect(result).toHaveLength(0);
  });

  it('should decrypt typeDetails', async () => {
    const result = await getConnections(ConnectionType.POSTGRES);
    expect(result[0].typeDetails).toEqual({ host: 'localhost', port: 5432, startDate: '2025-01-01T00:00:00.000Z' });
  });
});

describe('getConnection', () => {
  it('should return a connection by id', async () => {
    const result = await getConnection(connection.id);
    expect(result.name).toBe('Test Connection');
    expect(result.type).toBe(ConnectionType.POSTGRES);
  });

  it('should throw ApiError when connection not found', async () => {
    await expect(getConnection(99999)).rejects.toThrow(ApiError);
    await expect(getConnection(99999)).rejects.toThrow('Connection 99999 not found');
  });
});

describe('getConnectionBySyncedConnectionId', () => {
  it('should return connection from synced connection id', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    const result = await getConnectionBySyncedConnectionId(syncedConnection.id);
    expect(result.name).toBe('Test Connection');
  });

  it('should throw ApiError when synced connection not found', async () => {
    await expect(getConnectionBySyncedConnectionId(99999)).rejects.toThrow(ApiError);
    await expect(getConnectionBySyncedConnectionId(99999)).rejects.toThrow('Synced connection 99999 not found');
  });
});

describe('createSyncedConnection', () => {
  it('should create a new synced connection', async () => {
    const result = await createSyncedConnection({
      connectionId: connection.id,
    });

    expect(result.connectionId).toBe(connection.id);
    expect(result.status).toBe('ACTIVE');
    expect(result.percentCompleted).toBe(0);
  });
});

describe('updateSyncedConnection', () => {
  it('should update synced connection percent completed', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    const result = await updateSyncedConnection({
      syncedConnectionId: syncedConnection.id,
      percentCompleted: 50,
    });

    expect(result.percentCompleted).toBe(50);
  });
});

describe('updateSyncedConnectionStatus', () => {
  it('should update synced connection status', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    await updateSyncedConnectionStatus(syncedConnection.id, 'INACTIVE');

    const updated = await dbClient.syncedConnection.findUnique({
      where: { id: syncedConnection.id },
    });

    expect(updated?.status).toBe('INACTIVE');
  });
});

describe('getSyncedConnection', () => {
  it('should return synced connection by id', async () => {
    const created = await createSyncedConnection({
      connectionId: connection.id,
    });

    const result = await getSyncedConnection(created.id);
    expect(result.id).toBe(created.id);
    expect(result.connectionId).toBe(connection.id);
  });

  it('should throw ApiError when synced connection not found', async () => {
    await expect(getSyncedConnection(99999)).rejects.toThrow(ApiError);
    await expect(getSyncedConnection(99999)).rejects.toThrow('Synced connection 99999 not found');
  });
});

describe('createSyncedConnectionLog', () => {
  it('should create a new synced connection log', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    const result = await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-123',
      syncedDates: ['2025-01-01', '2025-01-02'],
      status: 'COMPLETED',
    });

    expect(result.syncedConnectionId).toBe(syncedConnection.id);
    expect(result.runId).toBe('run-123');
    expect(result.syncedDates).toEqual(['2025-01-01', '2025-01-02']);
    expect(result.status).toBe('COMPLETED');
  });

  it('should create log with error message', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    const result = await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-456',
      syncedDates: ['2025-01-01'],
      status: 'FAILED',
      error: 'Connection timeout',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('Connection timeout');
  });
});

describe('getUniqueSyncedDates', () => {
  it('should return unique synced dates', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-1',
      syncedDates: ['2025-01-01', '2025-01-02'],
      status: 'COMPLETED',
    });

    await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-2',
      syncedDates: ['2025-01-02', '2025-01-03'],
      status: 'COMPLETED',
    });

    const result = await getUniqueSyncedDates(syncedConnection.id);
    expect(result).toHaveLength(3);
    expect(result).toContain('2025-01-01');
    expect(result).toContain('2025-01-02');
    expect(result).toContain('2025-01-03');
  });
});

describe('getScheduledTaskLogs', () => {
  it('should return paginated logs', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-1',
      syncedDates: ['2025-01-01'],
      status: 'COMPLETED',
    });

    const result = await getSyncedConnectionLogs(connection.uuid, 10, 1);
    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe('run-1');
  });
});

describe('getSyncedConnectionLog', () => {
  it('should return synced connection log by id', async () => {
    const syncedConnection = await createSyncedConnection({
      connectionId: connection.id,
    });

    const created = await createSyncedConnectionLog({
      syncedConnectionId: syncedConnection.id,
      runId: 'run-123',
      syncedDates: ['2025-01-01'],
      status: 'COMPLETED',
    });

    const result = await getSyncedConnectionLog(created.id);
    expect(result.id).toBe(created.id);
    expect(result.runId).toBe('run-123');
  });

  it('should throw ApiError when log not found', async () => {
    await expect(getSyncedConnectionLog(99999)).rejects.toThrow(ApiError);
    await expect(getSyncedConnectionLog(99999)).rejects.toThrow('Synced connection log 99999 not found');
  });
});
