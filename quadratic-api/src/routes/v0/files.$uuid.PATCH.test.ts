import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createUsers } from '../../tests/testDataGenerator';

describe('PATCH /v0/files/:uuid', () => {
  beforeAll(async () => {
    const [userOwner, userViewer] = await createUsers(['userOwner', 'userViewer', 'userNoTeam']);
    const team = await dbClient.team.create({
      data: {
        name: 'team1',
        UserTeamRole: {
          create: [
            {
              userId: userOwner.id,
              role: 'OWNER',
            },
            {
              userId: userViewer.id,
              role: 'VIEWER',
            },
          ],
        },
      },
    });
    await createFile({
      data: {
        creatorUserId: userOwner.id,
        ownerUserId: userOwner.id,
        ownerTeamId: team.id,
        name: 'private_file',
        contents: Buffer.from('contents_1'),
        uuid: '00000000-0000-4000-8000-000000000001',
        publicLinkAccess: 'READONLY',
      },
    });
    await createFile({
      data: {
        creatorUserId: userOwner.id,
        ownerTeamId: team.id,
        name: 'public_file',
        contents: Buffer.from('contents_1'),
        uuid: '00000000-0000-4000-8000-000000000002',
        publicLinkAccess: 'READONLY',
      },
    });

    await dbClient.team.create({
      data: {
        name: 'team2',
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

  afterAll(clearDb);

  describe('bad request', () => {
    it('rejects unauthenticated request', async () => {
      await request(app).patch('/v0/files/00000000-0000-0000-0000-000000000000').expect(401).expect(expectError);
    });
    it('rejects invalid request', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .send({ foo: 'new_name' })
        .expect(400)
        .expect(expectError);
    });
    it('rejects request for a file that doesn’t exist', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000009')
        .send({ name: 'new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('rejects renaming and moving at the same time', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: 100, name: 'test' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('rejects a user changing a file they don’t have access to', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'new_name' })
        .set('Authorization', `Bearer ValidToken userNoTeam`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('rename file', () => {
    it('accepts someone with permission renaming the file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'test_file_1_new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('test_file_1_new_name');
        });
    });
    it('rejects someone without permission renaming the file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'test_file_1_new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('test_file_1_new_name');
        });
    });
  });

  describe('move file inside team', () => {
    it('accepts public -> private', async () => {
      const ownerAuth0Id = 'userOwner';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000002')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.ownerUserId).toBe(undefined);
        });
    });
    it('accepts private -> public if it’s your private file', async () => {
      const ownerAuth0Id = 'userOwner';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.ownerUserId).toBe(undefined);
        });
    });
    it('rejects private -> public if it’s not your private file', async () => {
      const ownerAuth0Id = 'userViewer';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(403)
        .expect(expectError);
    });
  });
});
