import { getUserIdByAuth0Id } from '../tests/helpers';
import { clearDb, createTeam, createUser } from '../tests/testDataGenerator';
import { ApiError } from '../utils/ApiError';
import { getTeamConnection } from './getTeamConnection';

beforeAll(async () => {
  const teamUser = await createUser({ auth0Id: 'teamUser' });
  await createUser({ auth0Id: 'otherUser' });

  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [{ userId: teamUser.id, role: 'OWNER' }],
    connections: [
      { uuid: '10000000-0000-0000-0000-000000000000', type: 'POSTGRES', name: 'Foo' },
      { uuid: '20000000-0000-0000-0000-000000000000', type: 'POSTGRES', archived: new Date() },
    ],
  });

  await createTeam({
    team: {
      uuid: '11111111-1111-1111-1111-111111111111',
    },
    users: [{ userId: teamUser.id, role: 'OWNER' }],
    connections: [{ uuid: '30000000-0000-0000-0000-000000000000', type: 'POSTGRES', name: 'Bar' }],
  });
});

afterAll(clearDb);

describe('getTeamConnection()', () => {
  describe('non-existent connection', () => {
    it('throws an 404', async () => {
      const userId = await getUserIdByAuth0Id('teamUser');
      try {
        await getTeamConnection({
          connectionUuid: '00000000-1111-0000-0000-000000000000',
          teamUuid: '00000000-0000-0000-0000-000000000000',
          userId,
        });
        throw new Error('Expected ApiError to be thrown');
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
        await getTeamConnection({
          connectionUuid: '20000000-0000-0000-0000-000000000000',
          teamUuid: '00000000-0000-0000-0000-000000000000',
          userId,
        });
        throw new Error('Expected ApiError to be thrown');
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
        await getTeamConnection({
          connectionUuid: '10000000-0000-0000-0000-000000000000',
          teamUuid: '00000000-0000-0000-0000-000000000000',
          userId,
        });
        throw new Error('Expected ApiError to be thrown');
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
      const result = await getTeamConnection({
        connectionUuid: '10000000-0000-0000-0000-000000000000',
        teamUuid: '00000000-0000-0000-0000-000000000000',
        userId,
      });
      expect(result.connection).toBeDefined();
      expect(result.team).toBeDefined();

      expect(result.connection.uuid).toBe('10000000-0000-0000-0000-000000000000');
      expect(result.team.userMakingRequest.id).toBe(userId);
    });
  });

  describe('connection you have access to but its on another team', () => {
    it('throws a 404', async () => {
      const userId = await getUserIdByAuth0Id('teamUser');
      try {
        await getTeamConnection({
          connectionUuid: '30000000-0000-0000-0000-000000000000',
          teamUuid: '00000000-0000-0000-0000-000000000000',
          userId,
        });

        throw new Error('Expected ApiError to be thrown');
      } catch (error) {
        const e = error as ApiError;
        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(404);
      }
    });
  });
});
