import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  // Create test users
  const user_1 = await createUser({ auth0Id: 'test_user_1' });

  const team = await createTeam({
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
    ],
  });

  // Create a test files
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'public_file',
      uuid: '00000000-0000-4000-8000-000000000000',
    },
  });
});

afterAll(clearDb);

describe('GET /v0/files/:uuid/checkpoints/:checkpointId', () => {
  it('responds with 1 checkpoint for a team file', async () => {
    const fileWithCheckpoint = await dbClient.file.findFirst({
      where: {
        uuid: '00000000-0000-4000-8000-000000000000',
      },
      include: {
        FileCheckpoint: true,
      },
    });
    const checkpointId = fileWithCheckpoint?.FileCheckpoint[0].id;

    await request(app)
      .get(`/v0/files/00000000-0000-4000-8000-000000000000/checkpoints/${checkpointId}`)
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(200)
      .expect((res) => {
        ApiSchemas['/v0/files/:uuid/checkpoints/:checkpointId.GET.response'].parse(res.body);
      });
  });
});
