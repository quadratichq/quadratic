import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError, getUserIdByAuth0Id } from '../../tests/helpers';
import { createFile } from '../../tests/testDataGenerator';

beforeEach(async () => {
  // Create some users
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
      auth0Id: 'userNoFileRole',
    },
  });

  // Create a file
  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
      name: 'File',
      uuid: '00000000-0000-4000-8000-000000000001',
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
    dbClient.userFileRole.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('DELETE /v0/files/:uuid/users/:userId', () => {
  describe('invalid request', () => {
    it('responds with a 400 for an invalid user', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/users/foo')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 for a user that isn’t in the system', async () => {
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/200000`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
  });

  describe('deleting yourself', () => {
    it('responds with a 400 if you’re the owner', async () => {
      const userAuth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${userAuth0Id}`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 200 and a directive to redirect', async () => {
      const userAuth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${userAuth0Id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ id: userId, redirect: true });
        });
    });
  });

  describe('deleting others', () => {
    it('responds with a 403 if you don’t have permission', async () => {
      const userAuth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });
    it('responds with a 404 for a user not associated with the file', async () => {
      const userAuth0Id = 'userNoFileRole';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('responds with a 200 if you can remove somebody else', async () => {
      const userAuth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ id: userId });
        });
    });
  });
});
