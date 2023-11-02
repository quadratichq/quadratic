import { User } from 'auth0';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users & team
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
  await dbClient.user.create({
    data: {
      auth0_id: 'test_user_4',
      id: 4,
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

// Mock Auth0 getUsersByEmail
jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsersByEmail: jest.fn().mockImplementation((email: string) => {
          const users: User[] = [
            {
              user_id: 'test_user_1',
              email: 'test_user_1@example.com',
              picture: null,
              name: 'Test User 1',
            },
            {
              user_id: 'test_user_2',
              email: 'test_user_2@example.com',
              picture: null,
              name: 'Test User 2',
            },
            {
              user_id: 'test_user_3',
              email: 'test_user_3@example.com',
              picture: null,
              name: 'Test User 3',
            },
            {
              user_id: 'test_user_4',
              email: 'test_user_4@example.com',
              picture: null,
              name: 'Test User 4',
            },
            {
              user_id: 'duplicate_emails_user_1',
              email: 'duplciate@example.com',
              picture: null,
              name: 'Duplicate Emails User 1',
            },
            {
              user_id: 'duplicate_emails_user_2',
              email: 'duplicate@example.com',
              picture: null,
              name: 'Duplicate Emails User 2',
            },
          ];
          return users.filter((user) => user.email === email);
        }),
      };
    }),
  };
});

// TODO unauthenticated requests

describe('POST /v0/teams/:uuid/sharing - bad data', () => {
  it('fails schema validation', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400)
      .expect(({ body: { error } }) => {
        expect(typeof error.message).toBe('string');
        expect(error).toHaveProperty('meta');
      });
  });
});

// TODO invite someone who is already a member
// describe('POST /v0/teams/:uuid/sharing - invite people who are already memebers', () => {
//   it('responds with a 204', async () => {
//     await request(app)
//       .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
//       .send({ email: 'test_user_2@example.com', role: 'EDITOR' })
//       .set('Accept', 'application/json')
//       .set('Authorization', `Bearer ValidToken test_user_1`)
//       .expect('Content-Type', /json/)
//       .expect(204);
//   });
// });

// TODO inviting yourself

// TODO these shouldn't fire if the user already exists on the team
describe('POST /v0/teams/:uuid/sharing - users who already have a Quadratic account', () => {
  // it('adds OWNER invited by OWNER', async () => {});
  // it('adds EDITOR invited by OWNER', async () => {});
  // it('adds VIEWER invited by OWNER', async () => {});
  it('rejects OWNER invited by EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('adds EDITOR invited by EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { email, role, id } }) => {
        expect(email).toBe('test_user_4@example.com');
        expect(role).toBe('EDITOR');
        expect(id).toBe(4);
      });
  });
  it('adds VIEWER invited by EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { email, role, id } }) => {
        expect(email).toBe('test_user_4@example.com');
        expect(role).toBe('VIEWER');
        expect(id).toBe(4);
      });
  });

  it('rejects OWNER invited by VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('rejects EDITOR invited by VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('rejects VIEWER invited by VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing')
      .send({ email: 'test_user_4@example.com', role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
});

// add users who don't yet have quadratic accounts
// it('adds OWNER inviting OWNER', async () => {});

// add users who are duplicates
