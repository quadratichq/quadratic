import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users & a team
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_owner',
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_editor',
    },
  });
  const user_3 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_viewer',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'no_team',
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
          { userId: user_2.id, role: 'EDITOR' },
          { userId: user_3.id, role: 'VIEWER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteUsers, deleteTeams]);
});

describe('PATCH /v0/teams/:uuid', () => {
  describe('sending a bad request', () => {
    it('responds with a 400 for an invalid UUID', async () => {
      await request(app)
        .patch(`/v0/teams/foo`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });
    it('responds with a 400 for sending invalid data', async () => {
      await request(app)
        .patch(`/v0/teams/foo`)
        .send({ cheese: 'swiss' })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });
    it('responds with a 400 for sending valid & invalid data', async () => {
      await request(app)
        .patch(`/v0/teams/foo`)
        .send({ name: 'Foobar', cheese: 'swiss' })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });
  });

  describe('update a team', () => {
    it('accepts change from OWNER', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Foobar');
        });
    });

    it('accepts change from EDITOR', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Foobar');
        });
    });

    it('rejects change from VIEWER', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect(403);
    });

    it('rejects change from someone who isn’t a team member', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken no_team`)
        .expect(403);
    });
  });
});
