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
      contents: {},
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.qUser.deleteMany();
  const deleteFiles = dbClient.qFile.deleteMany();

  await dbClient.$transaction([deleteFiles, deleteUsers]);
});

jest.mock('../../middleware/auth', () => {
  return {
    validateAccessToken: jest.fn().mockImplementation(async (req: JWTRequest, res: Response, next: NextFunction) => {
      if (req.headers.authorization === 'Bearer ValidToken') {
        req.auth = {
          sub: 'test_user_1',
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

describe('GET /v0/files/ with auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(1);
  });
});
