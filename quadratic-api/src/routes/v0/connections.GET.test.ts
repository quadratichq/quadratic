import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { createConnection, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamUser = await createUser({ auth0Id: 'teamUser' });
  await createUser({ auth0Id: 'noTeamUser' });

  const team = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [{ userId: teamUser.id, role: 'OWNER' }],
    connections: [{ type: 'POSTGRES', name: 'Created first' }],
  });

  await createConnection({
    teamId: team.id,
    type: 'POSTGRES',
    name: 'Created second',
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.connection.deleteMany(),
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('GET /v0/connections', () => {
  describe('get all connections for a team user', () => {
    it('responds with connection data', async () => {
      await request(app)
        .get('/v0/connections?team-uuid=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken teamUser`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(2);
          expect(res.body[0].uuid).toBeDefined();
          expect(res.body[0].name).toBeDefined();
          expect(res.body[0].createdDate).toBeDefined();
          expect(res.body[0].updatedDate).toBeDefined();
          expect(res.body[0].type).toBeDefined();
          expect(res.body[0].typeDetails).not.toBeDefined();

          expect(res.body[0].name).toBe('Created second');
          expect(res.body[1].name).toBe('Created first');
        });
    });
  });

  describe('get all connections for non-team user', () => {
    it('responds with a 403 if the file is private', async () => {
      await request(app)
        .get('/v0/connections?team-uuid=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken noTeamUser`)
        .expect(403)
        .expect(expectError);
    });
  });
});
