import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
  // Create a test user
  const user_1 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_1',
    },
  });

  // Create a test file
  await dbClient.file.create({
    data: {
      ownerUserId: user_1.id,
      name: 'test_file_1',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      publicLinkAccess: 'NOT_SHARED',
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.user.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();

  await dbClient.$transaction([deleteFiles, deleteUsers]);
});

// Mock Auth0 getUser
jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUser: jest.fn().mockImplementation((params: any) => {
          return {
            email: 'test@example.com',
            picture: 'https://s.gravatar.com/avat',
            name: 'Test Name',
          };
        }),
      };
    }),
  };
});

describe('UPDATE - POST /v0/files/:uuid/sharing with auth and owned file update file link permissions', () => {
  it('responds with json', async () => {
    // change file link permissions to READONLY
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .send({ publicLinkAccess: 'READONLY' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ message: 'File updated.' });

    // check file permission from owner
    const res2 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('publicLinkAccess');
    expect(res2.body.publicLinkAccess).toEqual('READONLY');

    // check file permission from another user
    const res3 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res3.body).toHaveProperty('publicLinkAccess');
    expect(res3.body.publicLinkAccess).toEqual('READONLY');

    // change file link permissions to NOT_SHARED
    const res4 = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .send({ publicLinkAccess: 'NOT_SHARED' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res4.body).toMatchObject({ message: 'File updated.' });

    // check file permission from owner
    const res5 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res5.body).toHaveProperty('publicLinkAccess');
    expect(res5.body.publicLinkAccess).toEqual('NOT_SHARED');

    // check file permission from another user not shared
    const res6 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(res6.body).toMatchObject({ error: { message: 'Permission denied' } });
  });

  it('fails with invalid publicLinkAccess', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .send({ publicLinkAccess: 'INVALID' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      location: 'body',
      msg: 'Invalid value',
      path: 'publicLinkAccess',
      type: 'field',
      value: 'INVALID',
    });

    const res1 = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000/sharing')
      .send({ publicLinkAccess: null })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res1.body).toHaveProperty('errors');
    expect(res1.body.errors).toHaveLength(1);
    expect(res1.body.errors[0]).toMatchObject({
      location: 'body',
      msg: 'Invalid value',
      path: 'publicLinkAccess',
      type: 'field',
      value: null,
    });
  });
});
