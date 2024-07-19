import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';
import { expectError } from '../tests/helpers';

beforeAll(async () => {
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userNoTeam',
    },
  });

  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      UserTeamRole: {
        create: [
          {
            userId: userOwner.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.userTeamRole.deleteMany(),
    dbClient.user.deleteMany(),
    dbClient.team.deleteMany(),
  ]);
});

jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsers: jest.fn().mockImplementation(({ q }: { q: string }) => {
          // example value for `q`: "user_id:(user1 OR user2)"
          const auth0Users = [
            {
              user_id: 'userOwner',
              email: 'owner@example.com',
              name: 'User Owner',
            },
            {
              user_id: 'userNoTeam',
              email: 'noteam@example.com',
            },
          ];
          return auth0Users.filter(({ user_id }) => q.includes(user_id));
        }),
      };
    }),
  };
});

// These are just for testing the middleware function that supplies team info
// to all the `/teams/:uuid` routes
describe('GET /v0/teams/:uuid', () => {
  it('responds with a 401 without authentication', async () => {
    await request(app).get('/v0/teams/foo').expect(401).expect(expectError);
  });
  it('responds with 400 for an invalid UUID', async () => {
    await request(app)
      .get('/v0/teams/foo')
      .set('Authorization', `Bearer ValidToken userOwner`)
      .expect(400)
      .expect(expectError);
  });
  it('responds with 404 for a valid UUID that doesn’t exist in the database', async () => {
    await request(app)
      .get('/v0/teams/10000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ValidToken userOwner`)
      .expect(404)
      .expect(expectError);
  });
  it('responds with 403 for a valid UUID but the user doesn’t have access to that team', async () => {
    await request(app)
      .get('/v0/teams/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ValidToken userNoTeam`)
      .expect(403)
      .expect(expectError);
  });
  it('responds with 200 for a valid request to a team the user has access', async () => {
    await request(app)
      .get('/v0/teams/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ValidToken userOwner`)
      .expect(200);
  });
});
