import { User } from 'auth0';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';

beforeEach(async () => {
  // Create some users & team
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_owner',
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_editor',
    },
  });
  const user_3 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_viewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'user_without_team',
    },
  });
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
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
  const deleteTeamInvites = dbClient.teamInvite.deleteMany();
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamInvites, deleteTeamUsers, deleteUsers, deleteTeams]);
});

// Mock Auth0 getUsersByEmail
jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsersByEmail: jest.fn().mockImplementation((email: string) => {
          const users: User[] = [
            {
              user_id: 'team_1_owner',
              email: 'team_1_owner@example.com',
              // picture: null,
              name: 'Test User 1',
            },
            {
              user_id: 'team_1_editor',
              email: 'team_1_editor@example.com',
              // picture: null,
              name: 'Test User 2',
            },
            {
              user_id: 'team_1_viewer',
              email: 'team_1_viewer@example.com',
              // picture: null,
              name: 'Test User 3',
            },
            {
              user_id: 'user_without_team',
              email: 'user_without_team@example.com',
              // picture: null,
              name: 'Test User 4',
            },
            {
              user_id: 'duplicate_emails_user_1',
              email: 'duplciate@example.com',
              // picture: null,
              name: 'Duplicate Emails User 1',
            },
            {
              user_id: 'duplicate_emails_user_2',
              email: 'duplicate@example.com',
              // picture: null,
              name: 'Duplicate Emails User 2',
            },
          ];
          return users.filter((user) => user.email === email);
        }),
      };
    }),
  };
});

describe('POST /v0/teams/:uuid/invites', () => {
  describe('sending a bad request', () => {
    it('responds with a 401 without authentication', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ role: 'OWNER', email: 'test@example.com' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .expect(expectError);
    });
    it('responds with a 404 for requesting a team that doesn’t exist', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000000/invites')
        .send({ email: 'test@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(404)
        .expect(expectError);
    });
    it('responds with a 400 for failing schema validation on the team UUID', async () => {
      await request(app)
        .post('/v0/teams/foo/invites')
        .send({ email: 'test@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 400 for failing schema validation on the payload', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('inviting yourself to a team', () => {
    it('responds with 400 for owners', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'team_1_owner@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with 400 for editors', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'team_1_editor@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('inviting someone to a team who is already a member', () => {
    it('responds with 400', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'team_1_editor@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('adding users who already have a Quadratic account but aren’t yet in the database', () => {
    it.todo("adds a user who exists in auth0 but doesn't exist yet in the database");
  });

  describe('adding users who already have a Quadratic account', () => {
    it('adds OWNER invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('user_without_team@example.com');
          expect(role).toBe('OWNER');
          expect(typeof id).toBe('number');
        });
    });
    it('adds EDITOR invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('user_without_team@example.com');
          expect(role).toBe('EDITOR');
          expect(typeof id).toBe('number');
        });
    });
    it('adds VIEWER invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('user_without_team@example.com');
          expect(role).toBe('VIEWER');
          expect(typeof id).toBe('number');
        });
    });

    it('rejects OWNER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('adds EDITOR invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('user_without_team@example.com');
          expect(role).toBe('EDITOR');
          expect(typeof id).toBe('number');
        });
    });
    it('adds VIEWER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('user_without_team@example.com');
          expect(role).toBe('VIEWER');
          expect(typeof id).toBe('number');
        });
    });

    it('rejects OWNER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects EDITOR invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects VIEWER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'user_without_team@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('adding users who don’t have a Quadratic account', () => {
    const email = 'jane_doe@example.com';
    it('adds OWNER invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds EDITOR invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds VIEWER invited by OWNER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });

    it('rejects OWNER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('adds EDITOR invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds VIEWER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect('Content-Type', /json/)
        .expect(201);
    });

    it('rejects OWNER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects EDITOR invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects VIEWER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
  });

  // TODO add users who have duplicate emails
  describe('adding users who have duplicate emails', () => {
    it.todo('what do we do?');
  });
});
