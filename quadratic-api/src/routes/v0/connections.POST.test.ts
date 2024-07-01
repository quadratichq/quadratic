import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeAll(async () => {
  const user = await dbClient.user.create({
    data: {
      auth0Id: 'user1',
    },
  });

  await dbClient.team.create({
    data: {
      uuid: '00000000-0000-0000-0000-000000000000',
      name: 'test team',
      // TODO: (connections) not necessary
      stripeCustomerId: '1',
      UserTeamRole: {
        create: [
          {
            role: 'OWNER',
            userId: user.id,
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.connection.deleteMany(),
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

const validPayload = {
  name: 'My connection',
  type: 'POSTGRES',
  typeDetails: JSON.stringify({}),
};

describe.skip('POST /v0/connections', () => {
  describe('bad request', () => {
    it('responds with a 400 if you don’t pass the team uuid', async () => {
      await request(app)
        .post('/v0/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send(validPayload)
        .expect(400);
    });
    it('responds with a 403 if you don’t have permission', async () => {
      await request(app).post('/v0/connections').set('Authorization', `Bearer ValidToken user1`).send({}).expect(400);
    });
    it('returns a 400 without all required fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, ...rest } = validPayload;
      await request(app)
        .post('/v0/connections?team-uuid=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken user1`)
        .send(rest)
        .expect(400);
    });
  });

  describe('postgres', () => {
    it('creates a connection', async () => {
      await request(app)
        .post('/v0/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send({
          name: 'First connection',
          type: 'POSTGRES',
          typeDetails: {
            host: 'localhost',
            port: 5432,
            typeDetails: 'postgres',
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
