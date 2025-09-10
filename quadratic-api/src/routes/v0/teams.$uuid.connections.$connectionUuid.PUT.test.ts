import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamUserOwner = await createUser({ auth0Id: 'teamUserOwner' });
  const teamUserViewer = await createUser({ auth0Id: 'teamUserViewer' });
  await createUser({ auth0Id: 'noTeamUser' });

  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [
      { userId: teamUserOwner.id, role: 'OWNER' },
      { userId: teamUserViewer.id, role: 'VIEWER' },
    ],
    connections: [{ type: 'POSTGRES', name: 'Connection1', uuid: '10000000-0000-0000-0000-000000000000' }],
  });
});

afterAll(clearDb);

const validPayload = {
  name: 'Updated connection',
  semanticDescription: 'description here',
  typeDetails: {
    foo: 'bar',
  },
};

describe('PUT /v0/teams/:uuid/connections/:connectionUuid', () => {
  describe('update a connection', () => {
    it('responds with a 200 and updated connection data', async () => {
      const connectionBefore = await dbClient.connection.findUnique({
        where: { uuid: '10000000-0000-0000-0000-000000000000' },
      });

      await request(app)
        .put('/v0/teams/00000000-0000-0000-0000-000000000000/connections/10000000-0000-0000-0000-000000000000')
        .send(validPayload)
        .set('Authorization', `Bearer ValidToken teamUserOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.uuid).toBeDefined();
          expect(res.body.name).toBeDefined();
          expect(res.body.createdDate).toBeDefined();
          expect(res.body.updatedDate).toBeDefined();
          expect(res.body.semanticDescription).toBeDefined();
          expect(res.body.type).toBeDefined();
          expect(res.body.typeDetails).toEqual(validPayload.typeDetails);
          expect(res.body.updatedDate).not.toBe(connectionBefore?.updatedDate.toISOString());
        });
    });

    it('responds with a 403 for users who cannot edit a connection', async () => {
      await request(app)
        .put('/v0/teams/00000000-0000-0000-0000-000000000000/connections/10000000-0000-0000-0000-000000000000')
        .send(validPayload)
        .set('Authorization', `Bearer ValidToken teamUserViewer`)
        .expect(403)
        .expect(expectError);
      await request(app)
        .put('/v0/teams/00000000-0000-0000-0000-000000000000/connections/10000000-0000-0000-0000-000000000000')
        .send(validPayload)
        .set('Authorization', `Bearer ValidToken noTeamUser`)
        .expect(403)
        .expect(expectError);
    });
  });
});
