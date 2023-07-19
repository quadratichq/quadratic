import { Response, NextFunction } from 'express';
import { Request as JWTRequest } from 'express-jwt';
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

  // Create a test files
  await dbClient.file.create({
    data: {
      ownerUserId: user_1.id,
      name: 'test_file_1',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      public_link_access: 'NOT_SHARED',
    },
  });

  await dbClient.file.create({
    data: {
      ownerUserId: user_1.id,
      name: 'test_file_1',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      public_link_access: 'READONLY',
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.user.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();

  await dbClient.$transaction([deleteFiles, deleteUsers]);
});

// For auth we expect the following Authorization header format:
// Bearer ValidToken {user.sub}
jest.mock('../../middleware/auth', () => {
  return {
    validateAccessToken: jest.fn().mockImplementation(async (req: JWTRequest, res: Response, next: NextFunction) => {
      // expected format is `Bearer ValidToken {user.sub}`
      if (req.headers.authorization?.substring(0, 17) === 'Bearer ValidToken') {
        req.auth = {
          sub: req.headers.authorization?.substring(18), // Extract user.sub from the Authorization header
        };
        return next();
      } else {
        return res.status(401).json({ error: { message: 'No authorization token was found' } });
      }
    }),
  };
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

describe('GET /v0/files/ with auth and files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(2);
    expect(res.body[0]).toMatchObject({ name: 'test_file_1' });
  });
});

describe('GET /v0/files/ with auth and no files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(0);
  });
});

describe('GET /v0/files/:uuid no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-0000-0000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('GET /v0/files/:uuid file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000009')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ message: 'File not found.' });
  });
});

describe('GET /v0/files/:uuid with auth and owned file', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toHaveProperty('file');
    expect(res.body).toHaveProperty('permission');
    expect(res.body.permission).toEqual('OWNER');
    expect(res.body.file.contents).toEqual({ data: [99, 111, 110, 116, 101, 110, 116, 115, 95, 48], type: 'Buffer' }); // contents_1
  });
});

describe('GET /v0/files/:uuid with auth and another users file shared readonly', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toHaveProperty('file');
    expect(res.body).toHaveProperty('permission');
    expect(res.body.permission).toEqual('READONLY');
    expect(res.body.file.contents).toEqual({ data: [99, 111, 110, 116, 101, 110, 116, 115, 95, 49], type: 'Buffer' });
  });
});

describe('GET /v0/files/:uuid with auth and another users file not shared', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // Forbidden

    expect(res.body).toMatchObject({ message: 'Permission denied.' });
  });
});
