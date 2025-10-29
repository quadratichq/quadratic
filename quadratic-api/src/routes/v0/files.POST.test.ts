import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile as createFileData, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const validPayload = {
  name: 'new_file_with_name',
  contents: 'new_file_contents',
  version: '1.0.0',
  teamUuid: '00000000-0000-4000-8000-000000000001',
};
const expectValidResponse = (res: any) => {
  expect(res.body.file).toHaveProperty('uuid');
  expect(res.body.file).toHaveProperty('name');
  expect(res.body.file.name).toBe('new_file_with_name');
};
const createFile = (payload: any, user: string = 'test_user_1') =>
  request(app).post('/v0/files').send(payload).set('Authorization', `Bearer ValidToken ${user}`);

describe('POST /v0/files', () => {
  beforeAll(async () => {
    // Create a test user
    const [test_user_1, test_user_2] = await createUsers(['test_user_1', 'test_user_2', 'test_user_3']);
    // Create a team
    const team = await dbClient.team.create({
      data: {
        name: 'test_team_1',
        uuid: '00000000-0000-4000-8000-000000000001',
        UserTeamRole: {
          create: [
            {
              userId: test_user_1.id,
              role: 'OWNER',
            },
            {
              userId: test_user_2.id,
              role: 'VIEWER',
            },
          ],
        },
      },
    });
    // Upgrade the team to paid so tests don't hit file limits
    await upgradeTeamToPro(team.id);
  });

  afterAll(clearDb);

  describe('bad requests', () => {
    it('rejects unauthorized request', async () => {
      await request(app).post('/v0/files/').send(validPayload).expect(401).expect(expectError);
    });
    it('rejects request with invalid payload', async () => {
      const { name, contents, version } = validPayload;
      await createFile({ name }).expect(400).expect(expectError);
      await createFile({ contents }).expect(400).expect(expectError);
      await createFile({ version }).expect(400).expect(expectError);
      await createFile({ name, contents }).expect(400).expect(expectError);
      await createFile({ name, version }).expect(400).expect(expectError);
      await createFile({ contents, version }).expect(400).expect(expectError);
      await createFile({ name, contents, version }).expect(400).expect(expectError);
    });
    it('rejects request with a team that doesn’t exist', async () => {
      await createFile({ ...validPayload, teamUuid: 'invalid_uuid' })
        .expect(404)
        .expect(expectError);
    });
    it('rejects request when user doesn’t have access to the team', async () => {
      await createFile(validPayload, 'test_user_3').expect(403).expect(expectError);
    });
    it('rejects request when user has access to team but doesn’t have write permission', async () => {
      await createFile(validPayload, 'test_user_2').expect(403).expect(expectError);
    });
  });

  describe('create a team file', () => {
    it('creates a public file', async () => {
      const createResponse = await createFile(validPayload)
        .expect(201)
        .expect(expectValidResponse)
        .expect((res) => {
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');
        });
      // check created file
      await request(app)
        .get(`/v0/files/${createResponse.body.file.uuid}`)
        .set('Authorization', `Bearer ValidToken test_user_1`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('file');
          expect(res.body.file.name).toEqual('new_file_with_name');
          expect(res.body.file.lastCheckpointVersion).toEqual('1.0.0');
          expect(res.body).toHaveProperty('team');
          expect(res.body.team.uuid).toEqual('00000000-0000-4000-8000-000000000001');
          expect(res.body).toHaveProperty('userMakingRequest');
          expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
          expect(res.body.userMakingRequest.fileTeamPrivacy).toEqual('PUBLIC_TO_TEAM');
        });
    });

    it('creates a private file', async () => {
      const createResponse = await createFile({ ...validPayload, isPrivate: true })
        .expect(201)
        .expect(expectValidResponse);
      // check created file
      await request(app)
        .get(`/v0/files/${createResponse.body.file.uuid}`)
        .set('Authorization', `Bearer ValidToken test_user_1`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('file');
          expect(res.body).toHaveProperty('userMakingRequest');
          expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
          expect(res.body.userMakingRequest.fileTeamPrivacy).toEqual('PRIVATE_TO_ME');
          expect(res.body.file.name).toEqual('new_file_with_name');
          expect(res.body.file.lastCheckpointVersion).toEqual('1.0.0');
        });
    });

    it('creates a private file as a team VIEWER', async () => {
      await createFile({ ...validPayload, isPrivate: true }, 'test_user_2')
        .expect(201)
        .expect(expectValidResponse)
        .expect((res) => {
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');
        });
    });
  });

  describe('file limit for unpaid plan', () => {
    it('rejects creating a file when unpaid team has reached the 3 file limit', async () => {
      // Create a new user and team for this test
      const [limitTestUser] = await createUsers(['limit_test_user']);

      const limitTeam = await dbClient.team.create({
        data: {
          name: 'limit_test_team',
          uuid: '00000000-0000-4000-8000-000000000002',
          UserTeamRole: {
            create: [
              {
                userId: limitTestUser.id,
                role: 'OWNER',
              },
            ],
          },
        },
      });

      // Don't upgrade team - keep it as unpaid/free plan

      // Create 3 files (the limit)
      for (let i = 0; i < 3; i++) {
        await createFileData({
          data: {
            uuid: `00000000-0000-0000-0000-0000000000${i.toString().padStart(2, '0')}`,
            name: `Test File ${i}`,
            creatorUserId: limitTestUser.id,
            ownerTeamId: limitTeam.id,
          },
        });
      }

      // Attempt to create a 4th file and expect rejection
      await request(app)
        .post('/v0/files')
        .send({
          name: 'file_over_limit',
          contents: 'contents',
          version: '1.0.0',
          teamUuid: '00000000-0000-4000-8000-000000000002',
        })
        .set('Authorization', 'Bearer ValidToken limit_test_user')
        .expect(403)
        .expect((res) => {
          expect(res.body.error.message).toBe(
            'Team has reached the maximum number of files for the free plan. Upgrade to continue.'
          );
        });
    });

    it('allows creating files beyond the limit for paid teams', async () => {
      // Create a new user and team for this test
      const [paidTestUser] = await createUsers(['paid_test_user']);

      const paidTeam = await dbClient.team.create({
        data: {
          name: 'paid_test_team',
          uuid: '00000000-0000-4000-8000-000000000003',
          UserTeamRole: {
            create: [
              {
                userId: paidTestUser.id,
                role: 'OWNER',
              },
            ],
          },
        },
      });

      // Upgrade team to paid plan
      await upgradeTeamToPro(paidTeam.id);

      // Create 3 files (which would be the limit for unpaid)
      for (let i = 0; i < 3; i++) {
        await createFileData({
          data: {
            uuid: `00000000-0000-0000-0001-0000000000${i.toString().padStart(2, '0')}`,
            name: `Test File ${i}`,
            creatorUserId: paidTestUser.id,
            ownerTeamId: paidTeam.id,
          },
        });
      }

      // Paid team should be able to create a 4th file (and more)
      await request(app)
        .post('/v0/files')
        .send({
          name: 'file_beyond_unpaid_limit',
          contents: 'contents',
          version: '1.0.0',
          teamUuid: '00000000-0000-4000-8000-000000000003',
        })
        .set('Authorization', 'Bearer ValidToken paid_test_user')
        .expect(201)
        .expect((res) => {
          expect(res.body.file.name).toBe('file_beyond_unpaid_limit');
        });
    });

    it('allows two users to each create private files up to their individual limit', async () => {
      // Create two users and a team
      const [multiUser1, multiUser2] = await createUsers(['multi_user_1', 'multi_user_2']);

      const multiTeam = await dbClient.team.create({
        data: {
          name: 'multi_user_team',
          uuid: '00000000-0000-4000-8000-000000000004',
          UserTeamRole: {
            create: [
              {
                userId: multiUser1.id,
                role: 'OWNER',
              },
              {
                userId: multiUser2.id,
                role: 'EDITOR',
              },
            ],
          },
        },
      });

      // User 1 creates 1 private file (the per-user limit is 1)
      await createFileData({
        data: {
          uuid: '00000000-0000-0000-0002-000000000001',
          name: 'User 1 File 1',
          creatorUserId: multiUser1.id,
          ownerTeamId: multiTeam.id,
        },
      });

      // User 2 should be able to create their own private file
      // even though user 1 already has 1 file (per-user limits are separate)
      await request(app)
        .post('/v0/files')
        .send({
          name: 'user_2_private_file',
          contents: 'contents',
          version: '1.0.0',
          teamUuid: '00000000-0000-4000-8000-000000000004',
          isPrivate: true,
        })
        .set('Authorization', 'Bearer ValidToken multi_user_2')
        .expect(201)
        .expect((res) => {
          expect(res.body.file.name).toBe('user_2_private_file');
        });

      // User 1 tries to create a second private file - should be blocked by per-user limit (1)
      await request(app)
        .post('/v0/files')
        .send({
          name: 'user_1_second_file',
          contents: 'contents',
          version: '1.0.0',
          teamUuid: '00000000-0000-4000-8000-000000000004',
          isPrivate: true,
        })
        .set('Authorization', 'Bearer ValidToken multi_user_1')
        .expect(403)
        .expect((res) => {
          expect(res.body.error.message).toBe(
            'Team has reached the maximum number of files for the free plan. Upgrade to continue.'
          );
        });

      // User 2 tries to create a second private file - should also be blocked by per-user limit (1)
      await request(app)
        .post('/v0/files')
        .send({
          name: 'user_2_second_file',
          contents: 'contents',
          version: '1.0.0',
          teamUuid: '00000000-0000-4000-8000-000000000004',
          isPrivate: true,
        })
        .set('Authorization', 'Bearer ValidToken multi_user_2')
        .expect(403)
        .expect((res) => {
          expect(res.body.error.message).toBe(
            'Team has reached the maximum number of files for the free plan. Upgrade to continue.'
          );
        });
    });
  });
});
