import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';
import { expectError } from '../tests/helpers';
import { clearDb, createFile } from '../tests/testDataGenerator';

beforeEach(async () => {
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
      email: 'userOwner@test.com',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userNoFileRole',
      email: 'userNoFileRole@test.com',
    },
  });
  const team = await dbClient.team.create({
    data: {
      name: 'Test Team 1',
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
  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerTeamId: team.id,
      contents: Buffer.from('contents_0'),
      version: '1.4',
      name: 'Private team file',
      uuid: '00000000-0000-4000-8000-000000000001',
    },
  });
  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
      ownerTeamId: team.id,
      name: 'Public team file',
      uuid: '00000000-0000-4000-8000-000000000002',
      deleted: true,
      deletedDate: new Date(),
    },
  });
});

afterEach(clearDb);

describe('getFile() middleware', () => {
  describe('sending an invalid request', () => {
    it('responds with a 400 for failing schema validation on the file UUID', async () => {
      await request(app)
        .get('/v0/files/foo/sharing')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 for requesting a file that doesn’t exist', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-222222222222')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('responds with a 410 for requesting a file that’s been deleted', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000002')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(410)
        .expect(expectError);
    });
    it('responds with a 403 for requesting a file you don’t have access to', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken userNoFileRole`)
        .expect(403)
        .expect(expectError);
    });
  });
  describe('sending a valid request', () => {
    it('responds with a 200 for a file you have access to', async () => {
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200);
    });
  });
});
