import { auth0Mock } from '../../tests/auth0Mock';
jest.mock('auth0', () =>
  auth0Mock([
    {
      user_id: 'user1',
      email: 'user1@example.com',
      picture: 'https://s.gravatar.com/avat',
      name: 'User One',
    },
    {
      user_id: 'user2',
      email: 'user2@example.com',
      picture: 'https://s.gravatar.com/avat',
      name: 'User Two',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import { clearDb, createFile, createTeam, createUsers } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const [user1, user2] = await createUsers(['user1', 'user2']);

  const team = await createTeam({
    users: [
      { userId: user1.id, role: 'OWNER' },
      { userId: user2.id, role: 'EDITOR' },
    ],
  });

  // Your file (with 1 invite and 1 user)
  await createFile({
    data: {
      creatorUserId: user1.id,
      ownerUserId: user1.id,
      ownerTeamId: team.id,
      name: 'file-owned-by-user-1',
      uuid: '00000000-0000-4000-8000-000000000001',
      FileInvite: {
        create: {
          email: 'usernotinystemyet@example.com',
          role: 'EDITOR',
        },
      },
      UserFileRole: {
        create: {
          userId: user2.id,
          role: 'EDITOR',
        },
      },
    },
  });
  // File you're invited to
  await createFile({
    data: {
      creatorUserId: user2.id,
      ownerUserId: user2.id,
      ownerTeamId: team.id,
      name: 'file-owned-by-user-2',
      uuid: '00000000-0000-4000-8000-000000000002',
      UserFileRole: {
        create: {
          userId: user1.id,
          role: 'EDITOR',
        },
      },
    },
  });
  // Private file
  await createFile({
    data: {
      creatorUserId: user2.id,
      ownerUserId: user2.id,
      ownerTeamId: team.id,
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000003',
    },
  });
  // Public file
  await createFile({
    data: {
      creatorUserId: user2.id,
      ownerUserId: user2.id,
      ownerTeamId: team.id,
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000004',
      publicLinkAccess: 'READONLY',
    },
  });
});

afterAll(clearDb);

// Shape of the data that should always exist across any sharing request
const expectSharingData = (res: any) => {
  expect(res.body).toHaveProperty('file');
  expect(res.body.file).toHaveProperty('publicLinkAccess');

  expect(res.body).toHaveProperty('users');
  expect(res.body.users).toBeInstanceOf(Array);

  expect(res.body).toHaveProperty('invites');
  expect(res.body.invites).toBeInstanceOf(Array);

  expect(res.body).toHaveProperty('userMakingRequest');
  expect(res.body.userMakingRequest).toHaveProperty('id');
  expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
  // fileRole and teamRole are conditional, based on the user

  // TODO: (teams) this will change with teams
  expect(res.body).toHaveProperty('owner');
  expect(res.body.owner).toHaveProperty('type');
  expect(res.body.owner).toHaveProperty('id');
  expect(res.body.owner).toHaveProperty('email');
  expect(res.body.owner).toHaveProperty('name');
  expect(res.body.owner).toHaveProperty('picture');
};

describe('GET /v0/files/:uuid/sharing', () => {
  // Any invalid requests should be handled by the middleware

  describe('a file you own', () => {
    it('responds with sharing data', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(200)
        .expect(expectSharingData)
        .expect((res) => {
          expect(res.body.userMakingRequest.fileRole).toBeUndefined();
          expect(res.body.userMakingRequest.teamRole).toBe('OWNER');
          expect(res.body.users).toHaveLength(1);
          expect(res.body.invites).toHaveLength(1);
        });
    });
  });

  describe('a file you’ve been added to as an editor', () => {
    it('responds with sharing data', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000002/sharing')
        .set('Authorization', `Bearer ValidToken user1`)
        // .expect((res) => console.log(res.body))
        .expect('Content-Type', /json/)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('file');
          expect(res.body.userMakingRequest.fileRole).toEqual('EDITOR');
        });
    });
  });

  describe('a file you have not been added to', () => {
    it('responds with a 403 if the file is private', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000003/sharing')
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(403);
    });
    it('responds with sharing data if the file is public', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000004/sharing')
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(200)
        .expect(expectSharingData);
    });
  });
});
