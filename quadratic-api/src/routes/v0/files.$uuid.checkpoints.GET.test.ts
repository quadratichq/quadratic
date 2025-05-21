import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import { clearDb, createFile, createTeam, createUsers } from '../../tests/testDataGenerator';

beforeAll(async () => {
  // Create test users
  const [user_1, user_2] = await createUsers(['test_user_1', 'test_user_2']);

  const team = await createTeam({
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
      {
        userId: user_2.id,
        role: 'EDITOR',
      },
    ],
  });

  await createFile({
    data: {
      creatorUserId: user_2.id,
      ownerTeamId: team.id,
      name: 'public_file',
      uuid: '00000000-0000-4000-8000-000000000000',
    },
  });
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      ownerUserId: user_1.id,
      name: 'private_file',
      uuid: '00000000-0000-4000-8000-000000000001',
    },
  });
});

afterAll(clearDb);

describe('GET /v0/files/:uuid/checkpoints - bad request', () => {
  it('responds with a 401 when no auth', async () => {
    await request(app).get('/v0/files/00000000-0000-4000-8000-000000000000/checkpoints').expect(401);
  });
  it('responds with a 404 when no file', async () => {
    await request(app)
      .get('/v0/files/10000000-0000-4000-8000-000000000000/checkpoints')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(404);
  });
});

describe('GET /v0/files/:uuid/checkpoints', () => {
  it('responds with 1 checkpoint for a team file', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/checkpoints')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(200)
      .expect((res) => {
        ApiSchemas['/v0/files/:uuid/checkpoints.GET.response'].parse(res.body);
        expect(res.body.file.name).toEqual('public_file');
        expect(res.body.checkpoints.length).toEqual(1);
      });
  });
  it('responds with 1 checkpoint for a private file you own', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001/checkpoints')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(200)
      .expect((res) => {
        ApiSchemas['/v0/files/:uuid/checkpoints.GET.response'].parse(res.body);
        expect(res.body.file.name).toEqual('private_file');
        expect(res.body.checkpoints.length).toEqual(1);
      });
  });
});
