import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';

beforeAll(async () => {
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_1',
      id: 1,
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'test_user_2',
      id: 2,
    },
  });

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

// We assume an authenticated request for all of these tests.
describe('GET /v0/teams/:uuid', () => {
  it.todo('responds with a 401 without authentication');
  it('responds with 400 for an invalid UUID', async () => {
    await request(app)
      .get('/v0/teams/foo')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(400);
  });
  it('responds with 404 for a valid UUID that doesn’t exist in the database', async () => {
    await request(app)
      .get('/v0/teams/10000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(404);
  });
  it('responds with 404 for a valid UUID but the user doesn’t have access to that team', async () => {
    await request(app)
      .get('/v0/teams/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect(404);
  });
});
