import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { getUserIdByAuth0Id } from '../../tests/helpers';

beforeEach(async () => {
  // Create some users
  const userOwner = await dbClient.user.create({
    data: {
      auth0_id: 'userOwner',
    },
  });
  const userEditor = await dbClient.user.create({
    data: {
      auth0_id: 'userEditor',
    },
  });
  const userViewer = await dbClient.user.create({
    data: {
      auth0_id: 'userViewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0_id: 'userNoFileRole',
    },
  });

  // Create a file
  await dbClient.file.create({
    data: {
      ownerUserId: userOwner.id,
      contents: Buffer.from('contents_0'),
      version: '1.4',
      name: 'File',
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
  await dbClient.$transaction([
    dbClient.userFileRole.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('DELETE /v0/files/:uuid/users/:userId', () => {
  // TODO: this is similar to editing users, as there is a matrix of
  // what a user can do based on whether they're part of a team, the file is public, etc.

  describe('invalid request', () => {
    it('responds with a 400 for an invalid user', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/users/foo')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400);
    });
    it('responds with a 403 for a user that isn’t assciated with a file', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/users/1400000')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
  describe('deleting yourself', () => {
    it('does not allow owners to remove themselves', async () => {
      const userAuth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken ${userAuth0Id}`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
    it('allows editors to remove themselves', async () => {
      const userAuth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken ${userAuth0Id}`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
    it('allows viewers to remove themselves', async () => {
      const userAuth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(userAuth0Id);
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken ${userAuth0Id}`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });
  /*
  describe('deleteing others as an owner', () => {
    it('allows owners to remove other owners', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/2')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
    it('allows owners to remove editors', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/users/2')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
    it('allows owners to remove viewers', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/users/3')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });
  describe('deleteing others as an editor', () => {
    it('doesn’t allow editors to remove owners', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/1')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
    it('allows editors to remove other editors', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/4')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
    it('allows editors to remove viewers', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/5')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });
  describe('deleteing others as a viewer', () => {
    it('doesn’t allow viewers to remove owners', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/1')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken test_user5`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
    it('doesn’t allow viewers to remove editors', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/3')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken test_user5`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
    it('doesn’t allow viewers to remove other viewers', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000002/users/6')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken test_user5`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
  */
});
