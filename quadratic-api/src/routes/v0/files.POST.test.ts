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
    await dbClient.team.create({
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

  describe('file limit for paid plan', () => {
    it('rejects creating a file when paid team has reached the 3 file limit', async () => {
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

      // Upgrade team to paid plan
      await upgradeTeamToPro(limitTeam.id);

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

      // todo: fails here...

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
          expect(res.body.error.message).toBe('Team has reached the maximum number of files for the paid plan.');
        });
    });
  });
});
