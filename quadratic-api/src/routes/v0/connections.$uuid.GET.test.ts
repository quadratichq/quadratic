import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
  const userWithConnection = await dbClient.user.create({
    data: {
      auth0Id: 'userWithConnection',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userWithoutConnection',
    },
  });

  await dbClient.connection.create({
    data: {
      uuid: '00000000-0000-0000-0000-000000000000',
      name: 'First connection',
      type: 'POSTGRES',
      typeDetails: JSON.stringify({
        host: 'localhost',
        port: '5432',
        database: 'postgres',
        username: 'root',
        password: 'password',
      }),
      UserConnectionRole: {
        create: {
          userId: userWithConnection.id,
          role: 'OWNER',
        },
      },
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

describe('GET /v0/connections/:uuid', () => {
  // TODO: move some of these tests into the connection middleware
  // TODO: archived connection
  describe('bad request', () => {
    it('responds with a 400 for an invalid uuid', async () => {
      await request(app)
        .get('/v0/connections/foo')
        .set('Authorization', `Bearer ValidToken userWithConnection`)
        .expect(400);
    });
    it('responds with a 404 for a connection that does not exist', async () => {
      await request(app)
        .get('/v0/connections/10000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken userWithConnection`)
        .expect(404);
    });
  });
  describe('a connection you own', () => {
    it('responds with a connection', async () => {
      await request(app)
        .get('/v0/connections/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken userWithConnection`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.uuid).toBeDefined();
          expect(body.name).toBeDefined();
          expect(body.createdDate).toBeDefined();
          expect(body.updatedDate).toBeDefined();
          expect(body.type).toBeDefined();
          expect(body.typeDetails).toBeDefined();
        });
    });
  });
  // TODO: sharing connections
  // describe('a connection you’ve been added to as an editor', () => {
  //   it.todo('responds with sharing data');
  // });
  describe('a connection you don’t have access to', () => {
    it('responds with a 403', async () => {
      await request(app)
        .get('/v0/connections/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken userWithoutConnection`)
        .expect(403);
    });
  });
});
