import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'teamOwner' });
});

afterEach(clearDb);

describe('POST /v0/user', () => {
  describe('bad request', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).post(`/v0/user`).send({ foo: 'bar' }).expect(401);
    });
    it('responds with 400 if no user is provided', async () => {
      await request(app).post(`/v0/user`).set('Authorization', `Bearer ValidToken teamOwner`).expect(400);
    });
    it('responds with 400 if the payload is malformed', async () => {
      await request(app)
        .post(`/v0/user`)
        .send({ foo: 'bar' })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
      await request(app)
        .post(`/v0/user`)
        .send({ onboardingResponses: { version: 1 } })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });

    it('responds with 400 if the payload is empty', async () => {
      await request(app).post(`/v0/user`).set('Authorization', `Bearer ValidToken teamOwner`).expect(400);
    });
  });

  describe('save the user onboarding responses', () => {
    it('responds with 200 if the request is valid', async () => {
      await request(app)
        .post(`/v0/user`)
        .send({ onboardingResponses: { __version: 1, foo: 'bar' } })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(200);
    });
  });
});
