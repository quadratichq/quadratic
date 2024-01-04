import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';

beforeEach(async () => {
  // Create some users & team
  // const userOwner = await dbClient.user.create({
  //   data: {
  //     auth0_id: 'userOwner',
  //   },
  // });
  // const userEditor = await dbClient.user.create({
  //   data: {
  //     auth0_id: 'userEditor',
  //   },
  // });
  // const userViewer = await dbClient.user.create({
  //   data: {
  //     auth0_id: 'userViewer',
  //   },
  // });
  // // await dbClient.user.create({
  // //   data: {
  // //     auth0_id: 'userNoRole',
  // //   },
  // // });
  // await dbClient.file.create({
  //   data: {
  //     ownerUserId: userOwner.id,
  //     contents: Buffer.from('contents_0'),
  //     version: '1.4',
  //     name: 'Personal File',
  //     uuid: '00000000-0000-4000-8000-000000000001',
  //     publicLinkAccess: 'NOT_SHARED',
  //     // teamId: team.id,
  //     UserFileRole: {
  //       create: [
  //         { userId: userEditor.id, role: 'EDITOR' },
  //         { userId: userViewer.id, role: 'VIEWER' },
  //       ],
  //     },
  //   },
  // });
});

afterEach(async () => {
  const deleteFileInvites = dbClient.fileInvite.deleteMany();
  const deleteFileUsers = dbClient.userFileRole.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();

  await dbClient.$transaction([deleteFileInvites, deleteFileUsers, deleteFiles, deleteUsers]);
});

describe('DELETE /v0/files/:uuid/invites/:inviteId', () => {
  describe('sending a bad request', () => {
    it('responds with a 400 for failing schema validation on the payload', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/invites/foo')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });

  // TODO: tests for inviting to files public/private or in a team, etc.
  // review all the tests below

  describe('deleting an invite', () => {
    describe('when you have a role associated with the file', () => {
      it.todo('as a file owner');
      it.todo('as a file editor');
      it.todo('as a file viewer');
    });
    describe('when you haven’t been invited to the file', () => {
      it.todo('the file’s public link is EDIT');
      it.todo('the file’s public link is READONLY');
      it.todo('the file’s public link is NOT_SHARED');
    });
    describe('when you are a team member', () => {
      it.todo('as a team owner');
      it.todo('as a team editor');
      it.todo('as a team viewer');

      it.todo('you are the file OWNER but your team access on the file is VIEWER');
    });
  });
});
