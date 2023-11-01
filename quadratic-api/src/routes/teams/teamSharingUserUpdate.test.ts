import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users
  const user_1 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_1',
      id: 1,
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_2',
      id: 2,
    },
  });
  const user_3 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_3',
      id: 3,
    },
  });

  // Create a team with one owner
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      id: 1,
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
          { userId: user_2.id, role: 'EDITOR' },
          { userId: user_3.id, role: 'VIEWER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteUsers, deleteTeams]);
});

describe('POST /v0/teams/:uuid/sharing/:userId - unauthenticated requests', () => {
  it('responds with a 401', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });
});

// TODO teamsharing middleware for /sharing/:userId

// TODO test that emails get sent?

describe('POST /v0/teams/:uuid/sharing/:userId - update yourself as editor', () => {
  it('doesn’t allow the user to upgrade themselves to owner', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .send({
        role: 'VIEWER',
      })
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('doesn’t do anything for a request to stay the same', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .send({
        role: 'EDITOR',
      })
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows the user to downgrade themselves to viewer', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .send({
        role: 'VIEWER',
      })
      .expect('Content-Type', /json/)
      .expect(200);
  });
});
