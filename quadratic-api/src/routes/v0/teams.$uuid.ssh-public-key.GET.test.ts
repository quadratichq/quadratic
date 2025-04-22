import request from 'supertest';
import { app } from '../../app';
import { expectError } from '../../tests/helpers';
import { clearDb, createTeam, createUser } from '../../tests/testDataGenerator';

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
});

afterAll(clearDb);

describe('GET /v0/teams/:uuid/ssh-public-key', () => {
  describe('get ssh public key for a team', () => {
    it('responds with ssh public key for a team owner', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/ssh-public-key')
        .set('Authorization', `Bearer ValidToken teamUserOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.sshPublicKey).toBeDefined();
        });
    });
    it('responds with a 403 for a user not part of the team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/ssh-public-key')
        .set('Authorization', `Bearer ValidToken noTeamUser`)
        .expect(403)
        .expect(expectError);
    });
  });
});
