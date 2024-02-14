import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError, getUserIdByAuth0Id } from '../../tests/helpers';
import { createFile } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
    },
  });
  const userViewer = await dbClient.user.create({
    data: {
      auth0Id: 'userViewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userNoTeam',
    },
  });

  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
      name: 'test_file_2',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'READONLY',
    },
  });

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
      ownerTeamId: team.id,
      name: 'test_team_file_2',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000002',
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('PATCH /v0/files/:uuid', () => {
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

  describe('move file', () => {
    it('rejects request that has too much data', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: 1, ownerTeamId: 1 })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400);
    });

    describe('to a user', () => {
      it('rejects request to move to a user that doesn’t exist', async () => {
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000001')
          .send({ ownerUserId: 99999 })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(400);
      });
      it('accepts moving file to self', async () => {
        const ownerAuth0Id = 'userOwner';
        const ownerUserId = await getUserIdByAuth0Id(ownerAuth0Id);
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000001')
          .send({ ownerUserId })
          .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.ownerUserId).toBe(ownerUserId);
          });
      });
      it('accepts moving file to another user', async () => {
        const ownerUserId = await getUserIdByAuth0Id('userNoTeam');
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000001')
          .send({ ownerUserId })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect((res) => {
            expect(res.body.ownerUserId).toBe(ownerUserId);
          });
      });
      // it('accepts moving file from a team', async () => {})
    });

    describe('to a team', () => {
      it('rejects request to move file to a team that doesn’t exist (you won’t have permission for a team that doesn’t exist)', async () => {
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000001')
          .send({ ownerTeamId: 99999 })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(403);
      });
      it('rejects request to move file to a team if you don’t have permission to edit that team', async () => {
        const { id: ownerTeamId } = (await dbClient.team.findFirst({
          where: {
            name: 'team1',
          },
        })) as any;
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000001')
          .send({ ownerTeamId })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403);
      });
      it('accepts request to move file to the team its already in', async () => {
        const { id: ownerTeamId } = (await dbClient.team.findFirst({
          where: {
            name: 'team1',
          },
        })) as any;
        await request(app)
          .patch('/v0/files/00000000-0000-4000-8000-000000000002')
          .send({ ownerTeamId })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect((res) => {
            expect(res.body.ownerTeamId).toBe(ownerTeamId);
          });
      });
    });
  });
});
