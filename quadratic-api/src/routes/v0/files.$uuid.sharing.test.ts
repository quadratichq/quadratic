describe('PATCH /v0/files/:uuid/users/:userId', () => {
  it.todo('to come...');
});

// import request from 'supertest';
// import { app } from '../../app';
// import dbClient from '../../dbClient';

// beforeAll(async () => {
//   // Create a test user
//   const user_1 = await dbClient.user.upsert({
//     create: {
//       auth0Id: 'test_user_1',
//       id: 1,
//     },
//     update: {},
//     where: {
//       id: 1,
//     },
//   });
//   const team_user = await dbClient.user.upsert({
//     create: {
//       auth0Id: 'test_user_2',
//       id: 2,
//     },
//     update: {},
//     where: {
//       id: 2,
//     },
//   });
//   const user_added_to_file = await dbClient.user.upsert({
//     create: {
//       auth0Id: 'test_user_added_to_file',
//       id: 3,
//     },
//     update: {},
//     where: {
//       id: 3,
//     },
//   });

//   /*

// PER file for each of these

// `user1` with `fileNoTeam`
//   x - invite `teamUserOwner` to file as owner
//   ✓ - invite `teamUserOwner` to file as editor
//   ✓ - update `teamUserOwner` to file as viewer
//   ✓ - remove `teamUserOwner` from file

// `user1` with `filePublicRead`

// `teamUserOwner` & `teamUserEditor` in team with `fileTeam`
//   x - invite `user1` to `fileTeam` as owner
//   ✓ - invite `user1` to `fileTeam` as editor
//   ✓ - update `user1` in `fileTeam` to viewer
//   ✓ - remove `user1` from `fileTeam`

// `teamUserViewer` in team with `fileTeam`

// userTeamOwner     x

//   */
//   // userNotInTeam    filePrivate

//   // userTeamOwner    fileInTeam
//   // userTeamEditor   ""
//   // userTeamViewer   ""

//   // userFileOwner    fileNotInTeam/fileInTeam
//   // userFileEditor   ""
//   // userFileViewer   ""

//   // fileTeam
//   // filePrivate
//   // filePublicRead
//   // filePublicEdit

//   // Create a test file without any sharing
//   await dbClient.file.upsert({
//     create: {
//       id: 1,
//       ownerUserId: user_1.id,
//       name: 'test_file_1',
//       contents: Buffer.from('contents_0'),
//       uuid: '00000000-0000-4000-8000-000000000001',
//       publicLinkAccess: 'NOT_SHARED',
//     },
//     update: {},
//     where: {
//       uuid: '00000000-0000-4000-8000-000000000001',
//     },
//   });

//   // Create a file with a shared public link
//   await dbClient.file.upsert({
//     create: {
//       id: 2,
//       ownerUserId: user_1.id,
//       name: 'test_file_2',
//       contents: Buffer.from('contents_0'),
//       uuid: '00000000-0000-4000-8000-000000000002',
//       publicLinkAccess: 'READONLY',
//     },
//     update: {},
//     where: {
//       uuid: '00000000-0000-4000-8000-000000000002',
//     },
//   });

//   // Create a team and a file in that team
//   await dbClient.team.upsert({
//     create: {
//       id: 1,
//       name: 'test_team_1',
//       uuid: '00000000-0000-3000-8000-000000000001',
//       picture: null,
//       UserTeamRole: {
//         create: [
//           {
//             userId: user_1.id,
//             role: 'OWNER',
//           },
//         ],
//       },
//     },
//     update: {},
//     where: {
//       uuid: '00000000-0000-3000-8000-000000000001',
//     },
//   });
//   await dbClient.file.upsert({
//     create: {
//       id: 3,
//       ownerUserId: user_1.id,
//       name: 'test_file_team',
//       contents: Buffer.from('contents_0'),
//       uuid: '00000000-0000-4000-8000-000000000003',
//       publicLinkAccess: 'NOT_SHARED',
//       teamId: 1,
//       UserFileRole: {
//         create: {
//           userId: user_added_to_file.id,
//           role: 'EDITOR',
//         },
//       },
//     },
//     update: {},
//     where: {
//       uuid: '00000000-0000-4000-8000-000000000003',
//     },
//   });
// });

// afterAll(async () => {
//   const deleteFileRoles = dbClient.userFileRole.deleteMany();
//   const deleteTeamRoles = dbClient.userTeamRole.deleteMany();
//   const deleteTeams = dbClient.team.deleteMany();
//   const deleteFiles = dbClient.file.deleteMany();
//   const deleteUsers = dbClient.user.deleteMany();

//   await dbClient.$transaction([deleteFileRoles, deleteTeamRoles, deleteTeams, deleteFiles, deleteUsers]);
// });

// // Mock Auth0 getUser
// jest.mock('auth0', () => {
//   return {
//     ManagementClient: jest.fn().mockImplementation(() => {
//       return {
//         getUser: jest.fn().mockImplementation((params: any) => {
//           return {
//             email: 'test@example.com',
//             picture: 'https://s.gravatar.com/avat',
//             name: 'Test Name',
//           };
//         }),
//       };
//     }),
//   };
// });

// describe('GET /v0/files/:uuid/sharing', () => {
//   describe('invalid request', () => {
//     it('responds with a 401 for no auth', async () => {
//       await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .set('Accept', 'application/json')
//         .expect('Content-Type', /json/)
//         .expect(401);
//     });
//   });

//   describe('a file you own', () => {
//     // it('responds with json', async () => {
//     //   await request(app)
//     //     .get('/v0/files/00000000-0000-4000-8000-000000000002/sharing')
//     //     .set('Accept', 'application/json')
//     //     .set('Authorization', `Bearer ValidToken test_user_1`)
//     //     .expect('Content-Type', /json/)
//     //     .expect(200)
//     //     .expect((res) => {
//     //       expect(res.body).toHaveProperty('file');
//     //       expect(res.body.user).toEqual({
//     //         id: 1,
//     //         permissions: ['FILE_EDIT', 'FILE_VIEW', 'FILE_DELETE'],
//     //         role: 'OWNER',
//     //       });
//     //     });
//     // });
//   });

//   describe('a file you have access to via a team', () => {
//     it('responds with json for a team OWNER', async () => {
//       await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000003/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_1`)
//         .expect('Content-Type', /json/)
//         .expect(200)
//         .expect((res) => {
//           expect(res.body).toHaveProperty('file');
//           expect(res.body.user.id).toEqual(1);
//           expect(res.body.user.role).toEqual('OWNER');
//           expect(res.body.user.permissions.sort()).toEqual(['FILE_EDIT', 'FILE_VIEW', 'FILE_DELETE'].sort());
//         });
//     });
//     it.todo('responds with json for a team EDITOR');
//     it.todo('responds with json for a team VIEWER');
//   });

//   describe('a file shared publicly with you', () => {
//     it.todo('responds with json for a file VIEWER');
//     it.todo('responds with json for a file EDITOR');
//   });

//   describe('a file you’ve been added to', () => {
//     it('responds with json for a file EDITOR', async () => {
//       await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000003/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_added_to_file`)
//         .expect('Content-Type', /json/)
//         .expect(200)
//         .expect((res) => {
//           expect(res.body).toHaveProperty('file');
//           expect(res.body.user.id).toEqual(3);
//           expect(res.body.user.role).toEqual('EDITOR');
//           expect(res.body.user.permissions.sort()).toEqual(['FILE_EDIT', 'FILE_VIEW'].sort());
//         });
//     });
//     it.todo('responds with json for a file VIEWER');
//   });

//   describe('a file you have multiple forms of access to', () => {
//     it.todo('responds with json...');
//   });
// });

// /*
// describe('POST /v0/files/:uuid/sharing', () => {
//   describe(' with auth and owned file update file link permissions', () => {
//     it('responds with json', async () => {
//       // change file link permissions to READONLY
//       const res = await request(app)
//         .post('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .send({ publicLinkAccess: 'READONLY' })
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_1`)
//         .expect('Content-Type', /json/)
//         .expect(200); // OK

//       expect(res.body).toMatchObject({ message: 'File updated.' });

//       // check file permission from owner
//       const res2 = await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_1`)
//         .expect('Content-Type', /json/)
//         .expect(200); // OK

//       expect(res2.body.file.publicLinkAccess).toEqual('READONLY');

//       // check file permission from another user
//       const res3 = await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_2`)
//         .expect('Content-Type', /json/)
//         .expect(200); // OK

//       expect(res3.body.file.publicLinkAccess).toEqual('READONLY');

//       // change file link permissions to NOT_SHARED
//       const res4 = await request(app)
//         .post('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .send({ publicLinkAccess: 'NOT_SHARED' })
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_1`)
//         .expect('Content-Type', /json/)
//         .expect(200); // OK

//       expect(res4.body).toMatchObject({ message: 'File updated.' });

//       // check file permission from owner
//       const res5 = await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_1`)
//         .expect('Content-Type', /json/)
//         .expect(200); // OK

//       expect(res5.body.file.publicLinkAccess).toEqual('NOT_SHARED');

//       // check file permission from another user not shared
//       const res6 = await request(app)
//         .get('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//         .set('Accept', 'application/json')
//         .set('Authorization', `Bearer ValidToken test_user_2`)
//         .expect('Content-Type', /json/)
//         .expect(403);

//       expect(res6.body).toMatchObject({ error: { message: 'Permission denied' } });
//     });

//     it('fails with invalid publicLinkAccess', async () => {
//       // const res = await request(app)
//       //   .post('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//       //   .send({ publicLinkAccess: 'INVALID' })
//       //   .set('Accept', 'application/json')
//       //   .set('Authorization', `Bearer ValidToken test_user_1`)
//       //   .expect('Content-Type', /json/)
//       //   .expect(400);
//       // expect(res.body).toHaveProperty('error');
//       // expect(res.body.error.meta.name).toEqual('ZodError');
//       // const res1 = await request(app)
//       //   .post('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
//       //   .send({ publicLinkAccess: null })
//       //   .set('Accept', 'application/json')
//       //   .set('Authorization', `Bearer ValidToken test_user_1`)
//       //   .expect('Content-Type', /json/)
//       //   .expect(400);
//       // expect(res1.body).toHaveProperty('error');
//       // expect(res1.body.error.meta.name).toEqual('ZodError');
//     });
//   });
// });
// */
