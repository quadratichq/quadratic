import { User } from 'auth0';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';

beforeEach(async () => {
  // Create some users & team
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
    },
  });
  const userEditor = await dbClient.user.create({
    data: {
      auth0Id: 'userEditor',
    },
  });
  const userViewer = await dbClient.user.create({
    data: {
      auth0Id: 'userViewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userNoRole',
    },
  });
  await dbClient.file.create({
    data: {
      ownerUserId: userOwner.id,
      contents: Buffer.from('contents_0'),
      version: '1.4',
      name: 'Personal File',
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'NOT_SHARED',
      // teamId: team.id,
      UserFileRole: {
        create: [
          { userId: userEditor.id, role: 'EDITOR' },
          { userId: userViewer.id, role: 'VIEWER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteFileInvites = dbClient.fileInvite.deleteMany();
  const deleteFileUsers = dbClient.userFileRole.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();

  await dbClient.$transaction([deleteFileInvites, deleteFileUsers, deleteFiles, deleteUsers]);
});

// Mock Auth0 getUsersByEmail
jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsersByEmail: jest.fn().mockImplementation((email: string) => {
          const users: User[] = [
            {
              user_id: 'userOwner',
              email: 'userOwner@example.com',
              // picture: null,
              name: 'Test User 1',
            },
            {
              user_id: 'userEditor',
              email: 'userEditor@example.com',
              // picture: null,
              name: 'Test User 2',
            },
            {
              user_id: 'userViewer',
              email: 'userViewer@example.com',
              // picture: null,
              name: 'Test User 3',
            },
            {
              user_id: 'userNoRole',
              email: 'userNoRole@example.com',
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

describe('POST /v0/files/:uuid/invites', () => {
  describe('sending a bad request', () => {
    it('responds with a 400 for failing schema validation on the file UUID', async () => {
      await request(app)
        .post('/v0/files/foo/invites')
        .send({ email: 'test@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 400 for failing schema validation on the payload', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  // TODO: tests for inviting to files public/private or in a team, etc.
  // review all the tests below

  describe('inviting yourself to a file', () => {
    // it('responds with 400 for owners', async () => {
    //   await request(app)
    //     .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
    //     .send({ email: 'userOwner@example.com', role: 'EDITOR' })
    //     .set('Accept', 'application/json')
    //     .set('Authorization', `Bearer ValidToken userOwner`)
    //     .expect('Content-Type', /json/)
    //     .expect(400)
    //     .expect(expectErrorMsg);
    // });
    it('responds with 400 for editors', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userEditor@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('inviting someone to a team who is already a member', () => {
    it('responds with 400', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userEditor@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
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
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('userNoRole@example.com');
          expect(role).toBe('OWNER');
          expect(typeof id).toBe('number');
        });
    });
    it('adds EDITOR invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('userNoRole@example.com');
          expect(role).toBe('EDITOR');
          expect(typeof id).toBe('number');
        });
    });
    it('adds VIEWER invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('userNoRole@example.com');
          expect(role).toBe('VIEWER');
          expect(typeof id).toBe('number');
        });
    });

    it('rejects OWNER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('adds EDITOR invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('userNoRole@example.com');
          expect(role).toBe('EDITOR');
          expect(typeof id).toBe('number');
        });
    });
    it('adds VIEWER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(({ body: { email, role, id } }) => {
          expect(email).toBe('userNoRole@example.com');
          expect(role).toBe('VIEWER');
          expect(typeof id).toBe('number');
        });
    });

    it('rejects OWNER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects EDITOR invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects VIEWER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('adding users who don’t have a Quadratic account', () => {
    const email = 'jane_doe@example.com';
    it('adds OWNER invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds EDITOR invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds VIEWER invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201);
    });

    it('rejects OWNER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('adds EDITOR invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201);
    });
    it('adds VIEWER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201);
    });

    it('rejects OWNER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects EDITOR invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects VIEWER invited by VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
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
