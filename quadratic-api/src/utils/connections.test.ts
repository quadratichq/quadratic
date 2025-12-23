import type { Connection, User } from '@prisma/client';
import { ConnectionType } from '@prisma/client';
import { clearDb, createConnection, createTeam, createUser } from '../tests/testDataGenerator';
import { ApiError } from './ApiError';
import { getConnection, getConnections } from './connections';
import { encryptFromEnv } from './crypto';

let team: Awaited<ReturnType<typeof createTeam>>;
let user: User;
let connection: Connection;

beforeEach(async () => {
  user = await createUser({ auth0Id: 'test-user' });
  team = await createTeam({ users: [{ userId: user.id, role: 'OWNER' }] });
  const typeDetails = JSON.stringify({ host: 'localhost', port: 5432, start_date: '2025-01-01' });
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
    expect(result[0].typeDetails).toEqual({ host: 'localhost', port: 5432, start_date: '2025-01-01' });
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
