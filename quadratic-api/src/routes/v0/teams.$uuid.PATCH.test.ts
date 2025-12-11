import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createUsers } from '../../tests/testDataGenerator';

beforeEach(async () => {
  // Create some users & a team
  const [user_1, user_2, user_3] = await createUsers(['team_1_owner', 'team_1_editor', 'team_1_viewer', 'no_team']);

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

afterEach(clearDb);

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
    it('accepts name change', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ name: 'Foobar' })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Foobar');
        });
    });
    it('accepts setting change for privacy if user is on a paid plan', async () => {
      await dbClient.team.update({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
        data: {
          stripeSubscriptionStatus: 'ACTIVE',
        },
      });
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { analyticsAi: false } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.analyticsAi).toBe(false);
        });
    });
    it('rejects setting change for privacy if user is not on a paid plan', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { analyticsAi: false } })
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect(403);
    });
    it('accepts key/value pair updates', async () => {
      // Create value
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ clientDataKv: { foo: 'bar' } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.clientDataKv.foo).toBe('bar');
        });

      // Update value
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ clientDataKv: { anotherValue: 'hello' } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.clientDataKv.foo).toBe('bar');
          expect(res.body.clientDataKv.anotherValue).toBe('hello');
        });
    });
  });

  describe('update team settings', () => {
    it('rejects settings update if user does not have TEAM_MANAGE permission', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { aiRules: 'test' } })
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(403);
    });

    it('rejects settings update if user does not have TEAM_EDIT permission', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { aiRules: 'test' } })
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect(403);
    });

    it('accepts updating team AI rules if user is OWNER', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { aiRules: 'Team AI rules' } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.aiRules).toBe('Team AI rules');
        });
    });

    it('accepts updating showConnectionDemo setting', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { showConnectionDemo: false } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.showConnectionDemo).toBe(false);
        });
    });

    it('accepts updating multiple settings at once', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({
          settings: {
            aiRules: 'Team AI rules',
            showConnectionDemo: false,
          },
        })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.aiRules).toBe('Team AI rules');
          expect(res.body.settings.showConnectionDemo).toBe(false);
        });
    });

    it('accepts setting aiRules to null', async () => {
      // Set initial rules
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { aiRules: 'Initial rules' } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      // Clear rules
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { aiRules: null } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.aiRules).toBeNull();
        });
    });

    it('rejects analyticsAi change if user is not on a paid plan', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { analyticsAi: false } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(403);
    });

    it('accepts analyticsAi change if user is on a paid plan', async () => {
      await dbClient.team.update({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
        data: {
          stripeSubscriptionStatus: 'ACTIVE',
        },
      });

      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { analyticsAi: false } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.analyticsAi).toBe(false);
        });
    });
  });
});
