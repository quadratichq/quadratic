import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile } from '../../tests/testDataGenerator';

beforeAll(async () => {
  // Create a test user
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_1',
      email: 'test_user_1@test.com',
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_2',
      email: 'test_user_2@test.com',
    },
  });

  const team = await dbClient.team.create({
    data: {
      name: 'Test team',
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });

  // Create a test files
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      ownerUserId: user_1.id,
      name: 'private_file',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      UserFileRole: {
        create: [
          {
            userId: user_2.id,
            role: 'EDITOR',
          },
        ],
      },
    },
  });
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'public_file',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      UserFileRole: {
        create: [
          {
            userId: user_2.id,
            role: 'EDITOR',
          },
        ],
      },
    },
  });
});

afterAll(clearDb);

describe('READ - GET /v0/files/ no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('READ - GET /v0/files/ with auth and files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files?shared=with-me')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(2);
    expect(res.body[0]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000000',
      name: 'public_file',
      thumbnail: null,
    });
    expect(res.body[0]).toHaveProperty('createdDate');
    expect(res.body[0]).toHaveProperty('updatedDate');
    expect(res.body[1]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000001',
      name: 'private_file',
      thumbnail: null,
    });
  });
});

describe('READ - GET /v0/files/ with auth and no files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files?shared=with-me')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(0);
  });
});
