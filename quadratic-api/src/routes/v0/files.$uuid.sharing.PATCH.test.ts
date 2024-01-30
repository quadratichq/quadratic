import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { createFile } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const user1 = await dbClient.user.create({
    data: {
      auth0Id: 'user1',
    },
  });
  const user2 = await dbClient.user.create({ data: { auth0Id: 'user2' } });

  // Your file (with 1 invite and 1 user)
  await createFile({
    data: {
      creatorUserId: user1.id,
      ownerUserId: user1.id,
      name: 'file-owned-by-user-1',
      uuid: '00000000-0000-4000-8000-000000000001',
      FileInvite: {
        create: {
          email: 'userNotInSystemYet@example.com',
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
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000003',
    },
  });
  // Public file
  await createFile({
    data: {
      creatorUserId: user2.id,
      ownerUserId: user2.id,
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000004',
      publicLinkAccess: 'EDIT',
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.fileInvite.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('PATCH /v0/files/:uuid/sharing', () => {
  it('lets you update your own file', async () => {
    await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
      .send({ publicLinkAccess: 'READONLY' })
      .set('Authorization', `Bearer ValidToken user1`)
      .expect(200)
      .expect((res) => {
        expect(res.body.publicLinkAccess).toEqual('READONLY');
      });
  });
  it('lets you update a file you belong to', async () => {
    await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000002/sharing')
      .send({ publicLinkAccess: 'EDIT' })
      .set('Authorization', `Bearer ValidToken user1`)
      .expect(200)
      .expect((res) => {
        expect(res.body.publicLinkAccess).toEqual('EDIT');
      });
  });
  it('doesn’t let you update someone else’s private file', async () => {
    await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000003/sharing')
      .send({ publicLinkAccess: 'EDIT' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken user1`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('lets you update the public link on someone else’s publicly-editable file, but after that you can’t change it again', async () => {
    await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000004/sharing')
      .send({ publicLinkAccess: 'READONLY' })
      .set('Authorization', `Bearer ValidToken user1`)
      .expect(200)
      .expect((res) => {
        expect(res.body.publicLinkAccess).toEqual('READONLY');
      });
    // You changed it to READONLY so you can't change it again
    await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000004/sharing')
      .send({ publicLinkAccess: 'EDIT' })
      .set('Authorization', `Bearer ValidToken user1`)
      .expect(403);
  });
});
