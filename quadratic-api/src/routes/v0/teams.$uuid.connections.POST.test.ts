import request from 'supertest';
import { app } from '../../app';
import { clearDb, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamUser = await createUser({ auth0Id: 'user1' });
  await createUser({ auth0Id: 'noteamuser' });

  await createTeam({
    users: [{ userId: teamUser.id, role: 'OWNER' }],
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
      name: 'test team',
    },
  });
});

afterAll(clearDb);

const validPayload = {
  name: 'My connection',
  semanticDescription: 'description here',
  type: 'POSTGRES',
  typeDetails: {},
  // typeDetails: {
  //   host: 'localhost',
  //   port: 5432,
  //   typeDetails: 'postgres',
  //   username: 'root',
  //   password: 'password',
  // },
};

describe('POST /v0/teams/:uuid/connections', () => {
  describe('bad request', () => {
    it('responds with a 400 if you don’t pass the team uuid', async () => {
      await request(app)
        .post('/v0/teams/foo/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send(validPayload)
        .expect(400);
    });
    it('responds with a 403 if you don’t have permission', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-0000-0000-000000000000/connections')
        .set('Authorization', `Bearer ValidToken noteamuser`)
        .send({})
        .expect(400);
    });
    it('returns a 400 without all required fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, ...rest } = validPayload;
      await request(app)
        .post('/v0/teams/00000000-0000-0000-0000-000000000000/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send(rest)
        .expect(400);
    });
  });

  describe('create connection', () => {
    it('creates a postgres connection', async () => {
      await request(app)
        .post('/v0/teams/00000000-0000-0000-0000-000000000000/connections')
        .set('Authorization', `Bearer ValidToken user1`)
        .send(validPayload)
        .expect(201)
        .expect((res) => {
          expect(res.body.uuid).toBeDefined();
        });
    });
  });
});
