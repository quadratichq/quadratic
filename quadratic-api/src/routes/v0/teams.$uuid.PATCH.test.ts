import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb } from '../../tests/testDataGenerator';

beforeEach(async () => {
  // Create some users & a team
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_owner',
      email: 'team_1_owner@test.com',
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_editor',
      email: 'team_1_editor@test.com',
    },
  });
  const user_3 = await dbClient.user.create({
    data: {
      auth0Id: 'team_1_viewer',
      email: 'team_1_viewer@test.com',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'no_team',
      email: 'no_team@test.com',
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
    it('accepts setting change', async () => {
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .send({ settings: { analyticsAi: false } })
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.settings.analyticsAi).toBe(false);
        });
    });
    it('accepst key/value pair updates', async () => {
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
});
