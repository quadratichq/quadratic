import { getUserIdByAuth0Id } from '../tests/helpers';
import { clearDb, createTeam, createUser } from '../tests/testDataGenerator';
import { ApiError } from '../utils/ApiError';
import { getConnection } from './getConnection';

beforeAll(async () => {
  const teamUser = await createUser({ auth0Id: 'teamUser' });
  await createUser({ auth0Id: 'otherUser' });

  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [{ userId: teamUser.id, role: 'OWNER' }],
    connections: [
      { uuid: '10000000-0000-0000-0000-000000000000', type: 'POSTGRES' },
      { uuid: '20000000-0000-0000-0000-000000000000', type: 'POSTGRES', archived: new Date() },
    ],
  });
});

afterAll(clearDb);

describe('getConnection()', () => {
  describe('non-existent connection', () => {
    it('throws an 404', async () => {
      const userId = await getUserIdByAuth0Id('teamUser');
      try {
        await getConnection({ uuid: '00000000-1111-0000-0000-000000000000', userId });
      } catch (error) {
        const e = error as ApiError;
        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(404);
      }
    });
  });

  describe('archived connection', () => {
    it('throws an 404', async () => {
      const userId = await getUserIdByAuth0Id('teamUser');
      try {
        await getConnection({ uuid: '20000000-0000-0000-0000-000000000000', userId });
      } catch (error) {
        const e = error as ApiError;
        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(404);
      }
    });
  });

  describe('connection you do not have access to', () => {
    it('throws an 403', async () => {
      const userId = await getUserIdByAuth0Id('otherUser');
      try {
        await getConnection({ uuid: '10000000-0000-0000-0000-000000000000', userId });
      } catch (error) {
        const e = error as ApiError;
        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(403);
      }
    });
  });

  describe('connection you have access to', () => {
    it('gives back a connection and its team', async () => {
      const userId = await getUserIdByAuth0Id('teamUser');
      const result = await getConnection({ uuid: '10000000-0000-0000-0000-000000000000', userId });
      expect(result.connection).toBeDefined();
      expect(result.team).toBeDefined();

      expect(result.connection.uuid).toBe('10000000-0000-0000-0000-000000000000');
      expect(result.team.userMakingRequest.id).toBe(userId);
    });
  });
});
