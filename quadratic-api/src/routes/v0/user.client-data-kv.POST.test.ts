import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'teamOwner' });
});

afterEach(clearDb);

describe('POST /v0/user/client-data-kv', () => {
  describe('bad request', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).post(`/v0/user/client-data-kv`).send({ foo: 'bar' }).expect(401);
    });
    it('responds with 400 if no user is provided', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });
    it('responds with 400 if the payload is malformed', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .send(['bar'])
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });
    it('responds with 400 if the payload is empty', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });
    it('responds with 400 if no valid data is provided', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .send({})
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });
  });

  describe('save the user client data kv', () => {
    it('responds with 200 if the request matches the typescript schema', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .send({ knowsAboutModelPicker: true })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ knowsAboutModelPicker: true });
        });
    });
    it('strips unknown key/value pairs', async () => {
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .send({ knowsAboutModelPicker: false, foo: 'bar' })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ knowsAboutModelPicker: false });
        });
      await request(app)
        .post(`/v0/user/client-data-kv`)
        .send({ foo: 'bar' })
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400);
    });
  });
});
