import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError, getUserIdByAuth0Id } from '../../tests/helpers';
import { createFile } from '../../tests/testDataGenerator';

beforeEach(async () => {
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
      auth0Id: 'userWithoutRole',
    },
  });

  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
      name: 'Test Team 1',
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
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

const expectRole = (role: string) => (res: request.Response) => {
  expect(res.body.role).toBe(role);
};

describe('PATCH /v0/files/:uuid/users/:userId', () => {
  describe('updating your role as the file owner', () => {
    it('responds with a 400', async () => {
      const auth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .send({ role: 'EDITOR' })
        .expect(400)
        .expect(expectError);
    });
  });
  describe('updating your role as a file user', () => {
    it('responds with a 200 if you didn’t change anything', async () => {
      const auth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .send({ role: 'EDITOR' })
        .expect(200)
        .expect(expectRole('EDITOR'));
    });
    it('responds with a 403 if you try to upgrade from VIEWER to EDITOR when the file isn’t publicly editable', async () => {
      const auth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .send({ role: 'EDITOR' })
        .expect(403)
        .expect(expectError);
    });
  });

  describe('updating your role as a file user when the public link is EDIT', () => {
    beforeEach(async () => {
      await dbClient.file.update({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
        data: { publicLinkAccess: 'EDIT' },
      });
    });
    it('responds with a 200 if you try to upgrade from VIEWER to EDITOR when the file is publicly editable', async () => {
      const auth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .send({ role: 'EDITOR' })
        .expect(200)
        .expect(expectRole('EDITOR'));
    });
    afterEach(async () => {
      await dbClient.file.update({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
        data: { publicLinkAccess: 'NOT_SHARED' },
      });
    });
  });
  describe('updating the role of others', () => {});
});
