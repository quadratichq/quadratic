import { Response, NextFunction } from 'express';
import { Request as JWTRequest } from 'express-jwt';
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
      contents: { version: 1.0 },
      uuid: '00000000-0000-4000-8000-000000000000',
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.qUser.deleteMany();
  const deleteFiles = dbClient.qFile.deleteMany();

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

    expect(res.body.length).toEqual(1);
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

describe('GET /v0/files/:uuid with auth and file', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ name: 'test_file_1', contents: { version: 1.0 } });
  });
});

describe('GET /v0/files/:uuid with auth and another users file', () => {
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
