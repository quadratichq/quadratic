import { User } from 'auth0';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { createFile } from '../../tests/testDataGenerator';

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
  await createFile({
    data: {
      name: 'Personal File',
      uuid: '00000000-0000-4000-8000-000000000001',
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
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
  await dbClient.$transaction([
    dbClient.fileInvite.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
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
            },
            {
              user_id: 'userEditor',
              email: 'userEditor@example.com',
            },
            {
              user_id: 'userViewer',
              email: 'userViewer@example.com',
            },
            {
              user_id: 'userNoRole',
              email: 'userNoRole@example.com',
            },
            {
              user_id: 'duplicate_emails_user_1',
              email: 'duplciate@example.com',
            },
            {
              user_id: 'duplicate_emails_user_2',
              email: 'duplicate@example.com',
            },
          ];
          return users.filter((user) => user.email === email);
        }),
      };
    }),
  };
});

const expectUser = (res: request.Response) => {
  expect(typeof res.body.userId).toBe('number');
  expect(typeof res.body.role).toBe('string');
  expect(typeof res.body.id).toBe('number');
};
const expectInvite = (res: request.Response) => {
  expect(typeof res.body.email).toBe('string');
  expect(typeof res.body.role).toBe('string');
  expect(typeof res.body.id).toBe('number');
};

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
        .send({ role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 400 for a bad role', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'test@gmail.com', role: 'OWNER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  // TODO: tests for inviting to files public/private or in a team, etc.
  // review all the tests below

  describe('inviting people who are already associated with the file', () => {
    describe('as the file owner', () => {
      it.todo('responds with a 400 when inviting yourself as owner');
      it.todo('responds with a 400 when inviting an exisiting EDITOR');
      it.todo('responds with a 400 when inviting an exisiting VIEWER');
      it.todo('responds with a 400 when inviting an exisiting invite');
    });
    describe('as an EDITOR', () => {
      it.todo('responds with a 400 when inviting the owner');
      it.todo('responds with a 400 when inviting yourself as EDITOR');
      it.todo('responds with a 400 when inviting an exisiting EDITOR');
      it.todo('responds with a 400 when inviting an exisiting invite');
    });
    describe('as a VIEWER', () => {
      it.todo('responds with a 403 when inviting the owner');
      it.todo('responds with a 403 when inviting yourself as EDITOR');
      it.todo('responds with a 403 when inviting an exisiting EDITOR');
      it.todo('responds with a 403 when inviting an exisiting invite');
    });
    describe('as a user with no role and the public link is NOT_SHARED', () => {
      it.todo('responds with a 403');
    });
    describe('as a user with no role and the public link is VIEWER', () => {
      it.todo('responds with a 403');
    });
    describe('as a user with no role and the public link is EDITOR', () => {
      it.todo('responds with a 400 when inviting the owner');
      it.todo('responds with a 201 when inviting yourself as EDITOR');
      it.todo('responds with a 201 when inviting yourself as VIEWER');
      it.todo('responds with a 403 when inviting an exisiting EDITOR');
      it.todo('responds with a 403 when inviting an exisiting VIEWER');
      it.todo('responds with a 403 when inviting an exisiting invite');
    });

    it('responds with 400 for inviting someone who is already a a user', async () => {
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

  describe('inviting users who already have a Quadratic account', () => {
    it('adds an EDITOR invited by file owner', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectUser);
    });
    it('adds a VIEWER invited by file owner', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectUser);
    });

    it('adds an EDITOR invited by an EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectUser);
    });
    it('adds a VIEWER invited by an EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectUser);
    });

    it('rejects an EDITOR invited by a VIEWER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email: 'userNoRole@example.com', role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403)
        .expect(expectError);
    });
    it('rejects a VIEWER invited by a VIEWER', async () => {
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
    it('adds an EDITOR invited by file owner', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectInvite);
    });
    it('adds VIEWER invited by OWNER', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectInvite);
    });

    it('adds EDITOR invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'EDITOR' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectInvite);
    });
    it('adds VIEWER invited by EDITOR', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ email, role: 'VIEWER' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect('Content-Type', /json/)
        .expect(201)
        .expect(expectInvite);
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
