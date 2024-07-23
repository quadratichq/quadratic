import request from 'supertest';
import { app } from '../../app';
import { clearDb, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamOwner = await createUser({ auth0Id: 'teamOwner' });
  await createUser({ auth0Id: 'teamViewer' });

  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [{ userId: teamOwner.id, role: 'OWNER' }],
    connections: [{ uuid: '10000000-0000-0000-0000-000000000000', type: 'POSTGRES' }],
  });
});

afterAll(clearDb);

describe('GET /v0/connections/:uuid', () => {
  describe('a team editor/owner', () => {
    it('responds with a connection', async () => {
      await request(app)
        .get('/v0/connections/10000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.uuid).toBeDefined();
          expect(body.name).toBeDefined();
          expect(body.createdDate).toBeDefined();
          expect(body.updatedDate).toBeDefined();
          expect(body.type).toBeDefined();
          expect(body.typeDetails).toBeDefined();
          expect(body.typeDetails).toBeInstanceOf(Object);
        });
    });
  });

  describe('a team viewer', () => {
    it('responds with a 403', async () => {
      await request(app)
        .get('/v0/connections/10000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ValidToken teamViewer`)
        .expect(403);
    });
  });
});
