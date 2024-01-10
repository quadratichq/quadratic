import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';
import { expectError } from '../tests/helpers';

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
      auth0Id: 'userNoFileRole',
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

describe('getFile() middleware', () => {
  describe('sending an invalid request', () => {
    it('responds with a 401 without authentication', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/invites')
        .send({ role: 'OWNER', email: 'test@example.com' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .expect(expectError);
    });
    it('responds with a 400 for failing schema validation on the file UUID', async () => {
      await request(app)
        .get('/v0/files/foo/sharing')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 for requesting a file that doesn’t exist', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000000')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken foo`)
        .expect('Content-Type', /json/)
        .expect(404)
        .expect(expectError);
    });
  });
  describe('sending a valid request', () => {
    it.todo('responds witha 200');
  });
});
