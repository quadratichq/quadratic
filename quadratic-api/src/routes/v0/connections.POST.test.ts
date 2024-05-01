import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
  await dbClient.user.create({
    data: {
      auth0Id: 'user1',
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.userConnectionRole.deleteMany(),
    dbClient.connection.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('POST /v0/connections', () => {
  describe('bad request', () => {
    it("responds with a 400 if the connection type isn't supported", async () => {
      await request(app)
        .post('/v0/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send({
          type: 'UNSUPPORTED',
        })
        .expect(400);
    });
  });
  describe('postgres', () => {
    it('returns a 400 without all required fields', async () => {
      await request(app)
        .post('/v0/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send({
          name: 'First connection',
        })
        .expect(400);
    });
    it.todo('creates a connection with only required fields');
    it('creates a postgres connection with all fields', async () => {
      await request(app)
        .post('/v0/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send({
          name: 'First connection',
          type: 'POSTGRES',
          database: {
            host: 'localhost',
            port: 5432,
            database: 'postgres',
            username: 'root',
            password: 'password',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.uuid).toBeDefined();
        });
    });
  });

  describe('mysql', () => {
    it.todo('returns a 400 without all required fields');
    it.todo('creates a connection with only required fields');
    it.todo('creates a connection with all fields');
  });
});
