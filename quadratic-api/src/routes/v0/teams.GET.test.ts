import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createUsers } from '../../tests/testDataGenerator';

describe('GET /v0/teams', () => {
  beforeEach(async () => {
    const [teamOwner] = await createUsers(['teamOwner', 'userNoTeam']);
    await dbClient.team.create({
      data: {
        name: 'Test Team 1',
        uuid: '00000000-0000-4000-8000-000000000001',
        UserTeamRole: {
          create: [
            {
              userId: teamOwner.id,
              role: 'OWNER',
            },
          ],
        },
      },
    });
    await dbClient.team.create({
      data: {
        name: 'Test Team 2',
        uuid: '00000000-0000-4000-8000-000000000002',
        UserTeamRole: {
          create: [
            {
              userId: teamOwner.id,
              role: 'OWNER',
            },
          ],
        },
      },
    });
  });

  afterEach(clearDb);

  describe('bad request', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).get(`/v0/teams/00000000-0000-4000-8000-000000000001`).expect(401).expect(expectError);
    });
    it('responds with 400 for an invalid team', async () => {
      await request(app)
        .get(`/v0/teams/foo`)
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with 404 for a team that doesn’t exist', async () => {
      await request(app)
        .get(`/v0/teams/90000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('responds with 403 for a team that exists but you don’t have access to', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken userNoTeam`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('getting a list of teams', () => {
    it('responds with 2 teams for a user belonging to two teams', async () => {
      await request(app)
        .get(`/v0/teams`)
        .set('Authorization', `Bearer ValidToken teamOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.teams).toHaveLength(2);
          expect(res.body.userMakingRequest).toHaveProperty('id');

          expect(res.body.teams[0].team).toHaveProperty('id');
          expect(res.body.teams[0].team).toHaveProperty('uuid', '00000000-0000-4000-8000-000000000001');
          expect(res.body.teams[0].team).toHaveProperty('name', 'Test Team 1');
          expect(res.body.teams[0].team).toHaveProperty('createdDate');
          expect(res.body.teams[0].userMakingRequest).toHaveProperty('teamPermissions');

          expect(res.body.teams[1].team).toHaveProperty('id');
          expect(res.body.teams[1].team).toHaveProperty('uuid', '00000000-0000-4000-8000-000000000002');
          expect(res.body.teams[1].team).toHaveProperty('name', 'Test Team 2');
          expect(res.body.teams[1].team).toHaveProperty('createdDate');
          expect(res.body.teams[0].userMakingRequest).toHaveProperty('teamPermissions');
        });
    });

    it('responds with 0 teams for a user belonging to 0 teams', async () => {
      await request(app)
        .get(`/v0/teams`)
        .set('Authorization', `Bearer ValidToken userNoTeam`)
        .expect(200)
        .expect((res) => {
          expect(res.body.teams).toHaveLength(0);
          expect(res.body.userMakingRequest).toHaveProperty('id');
        });
    });
  });
});
