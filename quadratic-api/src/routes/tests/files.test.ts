import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
  // Create a test user
  const user_1 = await dbClient.qUser.create({
    data: {
      auth0_user_id: 'test_user_1',
    },
  });

  // Create a test file
  await dbClient.qFile.create({
    data: {
      qUserId: user_1.id,
      name: 'test_file_1',
      contents: {},
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.qUser.deleteMany();
  const deleteFiles = dbClient.qFile.deleteMany();

  await dbClient.$transaction([deleteFiles, deleteUsers]);
});

describe('GET /v0/files/ no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('GET /v0/files/ with auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});
