import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users & team
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_owner',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'user_without_team',
    },
  });
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
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
            userId: user_1.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteTeamInvites = dbClient.teamInvite.deleteMany();
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamInvites, deleteTeamUsers, deleteUsers, deleteTeams]);
});

describe('GET /v0/teams', () => {
  describe('get a list of teams you belong to', () => {
    it('responds with two teams for a user belonging to two teams', async () => {
      await request(app)
        .get(`/v0/teams`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0]).toHaveProperty('uuid', '00000000-0000-4000-8000-000000000001');
          expect(res.body[0]).toHaveProperty('name', 'Test Team 1');
          expect(res.body[0]).toHaveProperty('createdDate');
          expect(res.body[1]).toHaveProperty('uuid', '00000000-0000-4000-8000-000000000002');
          expect(res.body[1]).toHaveProperty('name', 'Test Team 2');
          expect(res.body[1]).toHaveProperty('createdDate');
        });
    });

    it('responds with 0 teams for a user belonging to 0 teams', async () => {
      await request(app)
        .get(`/v0/teams`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken user_without_team`)
        .expect('Content-Type', /json/)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(0);
        });
    });
  });
});
