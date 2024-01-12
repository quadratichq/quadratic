// TEST

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { getUserIdByAuth0Id } from '../../tests/helpers';

beforeEach(async () => {
  // Create some users
  const userWithFileRoleOfOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userWithFileRoleOfOwner',
    },
  });
  const userWithFileRoleOfEditor = await dbClient.user.create({
    data: {
      auth0Id: 'userWithFileRoleOfEditor',
    },
  });
  const userWithFileRoleOfViewer = await dbClient.user.create({
    data: {
      auth0Id: 'userWithFileRoleOfViewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userWithoutFileRole',
    },
  });

  // await dbClient.team.create({
  //   data: {
  //     name: 'Test Team 1',
  //     uuid: '00000000-0000-2000-8000-000000000001',
  //     UserTeamRole: {
  //       create: [
  //         { userId: userWithFileRoleOfEditorAndTeamRoleOfOwner.id, role: 'OWNER' },
  //         //     { userId: userWithFileRoleOfOwner.id, role: 'OWNER' },
  //         //     { userId: userWithFileRoleOfEditorAndTeamRoleOfOwner.id, role: 'OWNER' },
  //         //     { userId: userWithFileRoleOfEditor.id, role: 'EDITOR' },
  //         //     { userId: userWithFileRoleOfViewer.id, role: 'VIEWER' },
  //       ],
  //     },
  //   },
  // });

  // Create a file with an owner, editor, and viewer and associated to a team
  await dbClient.file.create({
    data: {
      ownerUserId: userWithFileRoleOfOwner.id,
      contents: Buffer.from('contents_0'),
      version: '1.4',
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'NOT_SHARED',
      // teamId: team.id,
      UserFileRole: {
        create: [
          { userId: userWithFileRoleOfEditor.id, role: 'EDITOR' },
          { userId: userWithFileRoleOfViewer.id, role: 'VIEWER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();
  const deleteFileUsers = dbClient.userFileRole.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteTeams, deleteFileUsers, deleteFiles, deleteUsers]);
});

// describe('POST /v0/teams/:uuid/users/:userId - unauthenticated requests', () => {
//   it('responds with a 401', async () => {
//     await request(app)
//       .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/1')
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(401);
//   });
// });

async function itt(str: string) {
  try {
    const reg = /(.*): `(.*)`.*`(.*)`.*`(.*)`/g;
    const matches = reg.exec(str);
    // @ts-expect-error
    const [, expectation, userMakingRequest, userBeingChanged, role] = matches;

    it(str, async () => {
      const userBeingChangedId = await getUserIdByAuth0Id(userBeingChanged);
      // const userMakingRequestId = await getUserIdByAuth0Id(userMakingRequest);
      await request(app)
        .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userBeingChangedId}`)
        .send({ role })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken ${userMakingRequest}`)
        .expect('Content-Type', /json/)
        .expect((res) => {
          // console.log(res.body, userMakingRequestId, userBeingChangedId);
          if (expectation === 'accepts') {
            expect(res.status).toBe(200);
            expect(res.body.role).toBe(role);
          } else if (expectation === 'rejects') {
            expect(res.status).toBe(403);
          }
        });
    });
  } catch (e) {
    console.log(
      'Failed to run test. It that didn’t match the format: `[expectation]: `userMakingRequeset` changing role of `userBeingChanged` to `role`',
      e
    );
  }
}

// TODO unauthenticated requests
// TODO sending bad data
// TODO trying to change a user that don't exist or exists but not part of the team

describe('PATCH /v0/files/:uuid/users/:userId', () => {
  describe('When a file’s public link access is: NOT_SHARED', () => {
    itt('accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfOwner` to `OWNER`');
    itt('rejects: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    itt('rejects: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to `OWNER`');
    itt('accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    itt('accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfViewer` to `OWNER`');
    itt('accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    itt('accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfViewer` to `VIEWER`');

    itt('rejects: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `OWNER`');
    // itt('rejects: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    // itt('rejects: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `OWNER`');
    itt('accepts: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    itt('accepts: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `OWNER`');
    itt('accepts: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    itt('accepts: `userWithFileRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `VIEWER`');

    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfOwner` to `OWNER`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfEditor` to `OWNER`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfViewer` to `OWNER`');
    itt('rejects: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    itt('accepts: `userWithFileRoleOfViewer` changing role of `userWithFileRoleOfViewer` to `VIEWER`');

    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `OWNER`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `OWNER`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `OWNER`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `VIEWER`');

    // prettier-ignore
    // describe('userWithFileRoleOfOwner and is owner of team', () => {
    //   beforeEach(async () => {
    //     const team = await dbClient.team.findFirst({
    //       where: {
    //         uuid: '00000000-0000-2000-8000-000000000001',
    //       },
    //     });

    //     await dbClient.file.update({
    //       data: {
    //         // @ts-expect-error
    //         teamId: team.id
    //       },
    //       where: {
    //         uuid: '00000000-0000-4000-8000-000000000001',
    //       },
    //     });
    //   });
    //   itt('accepts: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfOwner` to `OWNER`');
    //   itt('rejects: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    //   itt('rejects: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    //   itt('rejects: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfEditor` to `OWNER`');
    //   itt('accepts: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    //   itt('accepts: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    //   itt('rejects: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfViewer` to `OWNER`');
    //   itt('accepts: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    //   itt('accepts: `userWithFileRoleOfOwner` as Team owner changing role of `userWithFileRoleOfViewer` to `VIEWER`');
    // });

    // describe('userWithFileRoleOfOwnerAndTeamRoleOfEditor', () => {
    //   itt('rejects: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `OWNER`');
    //   itt('rejects: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
    //   itt('rejects: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfOwner` to `VIEWER`');
    //   itt('rejects: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `OWNER`');
    //   itt('accepts: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
    //   itt('accepts: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfEditor` to `VIEWER`');
    //   itt('rejects: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `OWNER`');
    //   itt('accepts: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
    //   itt('accepts: `userWithFileRoleOfOwnerAndTeamRoleOfEditor` changing role of `userWithFileRoleOfViewer` to `VIEWER`');
    // });
  });

  describe('When a file’s public link access is: EDIT', () => {
    beforeEach(async () => {
      await dbClient.file.update({
        data: {
          publicLinkAccess: 'EDIT',
        },
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
      });
    });
    describe('userWithoutFileRole', () => {
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `OWNER`');
      // itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
      // itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `VIEWER`');

      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `OWNER`');
      itt('accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
      itt('accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `VIEWER`');

      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `OWNER`');
      itt('accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
      itt('accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `VIEWER`');
    });
  });

  describe('When a file’s public link access is: READONLY', () => {
    beforeEach(async () => {
      await dbClient.file.update({
        data: {
          publicLinkAccess: 'READONLY',
        },
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
      });
    });
    describe('userWithoutFileRole', () => {
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `OWNER`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `EDITOR`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to `VIEWER`');

      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `OWNER`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `EDITOR`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to `VIEWER`');

      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `OWNER`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `EDITOR`');
      itt('rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfViewer` to `VIEWER`');
    });
  });
});

/*

==================================================

Personal Files - NOT_SHARED | EDIT | READONLY

userWithFileRoleOfOwner
userWithFileRoleOfEditor
userWithFileRoleViewer
userWithoutFileRole

Team Files = NOT_SHARED | EDIT | READONLY

userWithFileRoleOfOwnerAndTeamRoleOfOwner
userWithFileRoleOfOwnerAndTeamRoleOfEditor
userWithFileRoleOfOwnerAndTeamRoleOfViewer - ???

userWithFileRoleOfEditorAndTeamRoleOfOwner
userWithFileRoleOfEditorAndTeamRoleOfEditor
userWithFileRoleOfEditorAndTeamRoleOfViewer

userWithFileRoleOfViewerAndTeamRoleOfOwner
userWithFileRoleOfViewerAndTeamRoleOfEditor
userWithFileRoleOfViewerAndTeamRoleOfViewer

userWithoutFileRoleAndTeamRoleOfOwner
userWithoutFileRoleAndTeamRoleOfEditor
userWithoutFileRoleAndTeamRoleOfViewer

=============================================


READONLY | EDIT | NOT_SHARED
rejects: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to OWNER
accepts: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to EDITOR
updates: `userWithFileRoleOfOwner` changing role of `userWithFileRoleOfEditor` to VIEWER


NOT_SHARED | EDIT | READONLY
rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to OWNER
rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to EDITOR
rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to VIEWER

when a file's public link access is: NOT_SHARED
  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to OWNER
  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to EDITOR
  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to VIEWER
when a file's public link access is: EDIT
  accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to OWNER
  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to EDITOR
  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to VIEWER
  rejects: `userWithoutFileRole` deleting `userWithFileRoleOfEditor`

  rejects: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to OWNER
  accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to EDITOR
  accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfEditor` to VIEWER

when a file's public link access is: READONLY
  accepts: `userWithoutFileRole` changing role of `userWithFileRoleOfOwner` to OWNER


it('rejects: ...', testUpdateUser());
function async testUpdateUser(userMakingRequest, userBeingChanged, role) {
  const userBeingChangedId = await getUserIdByAuth0Id(userBeingChanged);
  return request(app)
      .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userBeingChangedId}`)
      .send({ role })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken ${userMakingRequest}`)
      .expect('Content-Type', /json/)
      .expect(403);
}
function testDeleteUser() {}




[accepts: `userWithFileRoleOfOwner` changing `userWithFileRoleOfEditor` to `{ role: 'OWNER' }`],
[userWithFileRoleOfOwner, userWithFileRoleOfEditor, { role: 'OWNER' }, 'rejects'],













test('rejects', `userWithFileRoleOfOwner`, `userWithFileRoleOfEditor`, 'OWNER')

async function test(result, userMakingRequest, userBeingChanged, role) {
  it(`${result}: ${userMakingRequest} changing role of ${userBeingChanged} to ${role}`, async () => {
    const userId = await getUserIdByAuth0Id(userBeingChanged);
    request(app)
      .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
      .send({ role })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken ${userMakingRequest}`)
      .expect('Content-Type', /json/)
      .expect(403);
  }
}

*/
