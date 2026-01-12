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

describe('GET /v0/files/:uuid/checkpoints/sequences/:sequenceNumber - bad request', () => {
  it('responds with a 401 when no auth', async () => {
    await request(app).get('/v0/files/00000000-0000-4000-8000-000000000000/checkpoints/sequences/0').expect(401);
  });
  it('responds with a 404 when no file', async () => {
    await request(app)
      .get('/v0/files/10000000-0000-4000-8000-000000000000/checkpoints/sequences/0')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(404);
  });
  it('responds with a 404 when sequence number does not exist', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/checkpoints/sequences/999999')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(404);
  });
});

describe('GET /v0/files/:uuid/checkpoints/sequences/:sequenceNumber', () => {
  it('responds with checkpoint data for sequence 0', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/checkpoints/sequences/0')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(200)
      .expect((res) => {
        ApiSchemas['/v0/files/:uuid/checkpoints/sequences/:sequenceNumber.GET.response'].parse(res.body);
        expect(res.body.sequenceNumber).toEqual(0);
        expect(res.body.dataUrl).toBeDefined();
        expect(res.body.version).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      });
  });
  it('responds with checkpoint data for a private file you own', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001/checkpoints/sequences/0')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(200)
      .expect((res) => {
        ApiSchemas['/v0/files/:uuid/checkpoints/sequences/:sequenceNumber.GET.response'].parse(res.body);
        expect(res.body.sequenceNumber).toEqual(0);
      });
  });
  it('responds with a 403 for users without proper permissions', async () => {
    // user_2 is an EDITOR but doesn't own the private file
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001/checkpoints/sequences/0')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect(403);
  });
});
