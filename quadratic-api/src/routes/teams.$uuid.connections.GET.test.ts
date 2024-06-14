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
  await dbClient.connection.create({
    data: {
      name: 'Second connection',
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

describe('GET /v0/connections', () => {
  describe('connections you own', () => {
    it('responds with connection data ordered reverse chronological', async () => {
      await request(app)
        .get('/v0/connections')
        .set('Authorization', `Bearer ValidToken userWithConnection`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(2);
          expect(res.body[0].uuid).toBeDefined();
          expect(res.body[0].name).toBeDefined();
          expect(res.body[0].createdDate).toBeDefined();
          expect(res.body[0].updatedDate).toBeDefined();
          expect(res.body[0].type).toBeDefined();
          expect(res.body[0].typeDetails).not.toBeDefined();

          expect(res.body[0].name).toBe('Second connection');
          expect(res.body[1].name).toBe('First connection');
        });
    });
  });
  // TODO: (connections) sharing connections
  // // describe('a connection you’ve been added to as an editor', () => {
  // //   it.todo('responds with sharing data');
  // // });
  describe('you have access to zero connections', () => {
    it('responds with a 403 if the file is private', async () => {
      await request(app)
        .get('/v0/connections')
        .set('Authorization', `Bearer ValidToken userWithoutConnection`)
        .expect(200)
        .expect((res) => res.body.length === 0);
    });
  });
});
