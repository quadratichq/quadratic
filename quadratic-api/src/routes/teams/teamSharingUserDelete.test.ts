import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
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
  await dbClient.team.create({
    data: {
      name: 'Test Team 2',
      uuid: '00000000-0000-4000-8000-000000000002',
      id: 2,
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
          { userId: user_2.id, role: 'OWNER' },
        ],
      },
    },
  });
});

afterAll(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteUsers, deleteTeams]);
});

describe('DELETE /v0/teams/:uuid/sharing/:userId - no auth', () => {
  it('responds with JSON and a 401', async () => {
    const res = await request(app).get('/v0/files/').set('Accept', 'application/json');
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('DELETE /v0/teams/:uuid/sharing/:userId - invalid team', () => {
  it('responds with a 400 for an invalid UUID', async () => {
    await request(app)
      .delete('/v0/teams/foo/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400);
  });
  it('responds with a 404 for a valid UUID that doesn’t exist', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000000/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404);
  });
});

describe('DELETE /v0/teams/:uuid/sharing/:userId - invalid user', () => {
  // TODO
  // it('responds with a 404 for a valid user that doesn’t exist', async () => {
  //   await request(app)
  //     .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/245')
  //     .set('Accept', 'application/json')
  //     .set('Authorization', `Bearer ValidToken test_user_1`)
  //     .expect('Content-Type', /json/)
  //     .expect(404);
  // });
  it('responds with a 400 for an invalid user', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/foo')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('DELETE /v0/teams/:uuid/sharing/:userId - limiting access', () => {
  it('responds with a 404 for a team that the user doesn’t have access to', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(404);
  });
  it('responds with a 403 for a team the user only has view access to', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
});

describe('DELETE /v0/teams/:uuid/sharing/:userId - deleting yourself', () => {
  it('allows viewers to remove themselves from a team', async () => {
    await request(app)
      .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows editors to remove themselves from a team', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows owners to remove themselves from a team IF there’s at least one other owner', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('does not allow owners to remove themselves from a team IF they’re the only one', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
});

// describe('DELETE /v0/teams/:uuid/sharing/:userId - deleteing others as an owner', () => {});
