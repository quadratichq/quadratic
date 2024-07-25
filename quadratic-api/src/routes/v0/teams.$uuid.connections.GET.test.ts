import request from 'supertest';
import { app } from '../../app';
import { expectError } from '../../tests/helpers';
import { clearDb, createConnection, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamUserOwner = await createUser({ auth0Id: 'teamUserOwner' });
  const teamUserViewer = await createUser({ auth0Id: 'teamUserViewer' });
  await createUser({ auth0Id: 'noTeamUser' });

  const team = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [
      { userId: teamUserOwner.id, role: 'OWNER' },
      { userId: teamUserViewer.id, role: 'VIEWER' },
    ],
    connections: [{ type: 'POSTGRES', name: 'Created first' }],
  });

  await createConnection({
    teamId: team.id,
    type: 'POSTGRES',
    name: 'Created second',
  });
});

afterAll(clearDb);

describe('GET /v0/teams/:uuid/connections', () => {
  describe('get all connections in a team', () => {
    it('responds with connection data for a team owner', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/connections')
        .set('Authorization', `Bearer ValidToken teamUserOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(2);
          expect(res.body[0].uuid).toBeDefined();
          expect(res.body[0].name).toBeDefined();
          expect(res.body[0].createdDate).toBeDefined();
          expect(res.body[0].type).toBeDefined();

          expect(res.body[0].name).toBe('Created second');
          expect(res.body[1].name).toBe('Created first');
        });
    });
    it('responds with a 403 for a user not part of the team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/connections')
        .set('Authorization', `Bearer ValidToken noTeamUser`)
        .expect(403)
        .expect(expectError);
    });
  });
});
