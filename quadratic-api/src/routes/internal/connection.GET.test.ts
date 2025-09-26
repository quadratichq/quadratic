import request from 'supertest';
import { app } from '../../app';
import { M2M_AUTH_TOKEN } from '../../env-vars';
import { clearDb, createConnection, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const user = await createUser({ auth0Id: 'testUser' });

  const team1 = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000001',
    },
    users: [{ userId: user.id, role: 'OWNER' }],
  });

  const team2 = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000002',
    },
    users: [{ userId: user.id, role: 'OWNER' }],
  });

  // Create POSTGRES connections
  await createConnection({
    teamId: team1.id,
    type: 'POSTGRES',
    name: 'Postgres Connection 1',
  });

  await createConnection({
    teamId: team2.id,
    type: 'POSTGRES',
    name: 'Postgres Connection 2',
  });

  // Create MYSQL connection
  await createConnection({
    teamId: team1.id,
    type: 'MYSQL',
    name: 'MySQL Connection 1',
  });
});

afterAll(clearDb);

describe('GET /v0/internal/connection', () => {
  describe('authentication', () => {
    it('responds with 400 when Authorization header is missing', async () => {
      await request(app).get('/v0/internal/connection?type=POSTGRES').expect(400);
    });

    it('responds with 400 when Authorization header is invalid', async () => {
      await request(app)
        .get('/v0/internal/connection?type=POSTGRES')
        .set('Authorization', 'Bearer invalid-token')
        .expect(400);
    });
  });

  describe('parameter validation', () => {
    it('responds with 400 when type parameter is missing', async () => {
      await request(app).get('/v0/internal/connection').set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).expect(400);
    });

    it('responds with 400 when type parameter is invalid', async () => {
      await request(app)
        .get('/v0/internal/connection?type=INVALID_TYPE')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`)
        .expect(400);
    });
  });

  describe('successful requests', () => {
    it('responds with connections of the specified type', async () => {
      const response = await request(app)
        .get('/v0/internal/connection?type=POSTGRES')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      // If we get a 500 error, fail with detailed error information
      if (response.status === 500) {
        throw new Error(
          `500 Internal Server Error. Response body: ${JSON.stringify(response.body)}, Response text: ${response.text}`
        );
      }

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // 2 POSTGRES connections created in beforeAll

      response.body.forEach((connection: any) => {
        expect(connection).toHaveProperty('uuid');
        expect(connection).toHaveProperty('name');
        expect(connection).toHaveProperty('type');
        expect(connection).toHaveProperty('teamId');
        expect(connection).toHaveProperty('typeDetails');

        expect(connection.type).toBe('POSTGRES');
        expect(typeof connection.uuid).toBe('string');
        expect(typeof connection.name).toBe('string');
        expect(typeof connection.teamId).toBe('string');
        expect(typeof connection.typeDetails).toBe('object');
      });
    });

    it('responds with empty array when no connections of the specified type exist', async () => {
      await request(app)
        .get('/v0/internal/connection?type=SNOWFLAKE')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(0);
        });
    });

    it('filters connections by type correctly', async () => {
      const response = await request(app)
        .get('/v0/internal/connection?type=MYSQL')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      // If we get a 500 error, fail with detailed error information
      if (response.status === 500) {
        throw new Error(
          `500 Internal Server Error. Response body: ${JSON.stringify(response.body)}, Response text: ${response.text}`
        );
      }

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1); // 1 MYSQL connection created in beforeAll
      expect(response.body[0].type).toBe('MYSQL');
      expect(response.body[0].name).toBe('MySQL Connection 1');
    });
  });
});
