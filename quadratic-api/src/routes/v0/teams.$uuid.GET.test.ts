import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () =>
  workosMock([
    {
      id: 'team_1_owner',
      firstName: 'Test',
      lastName: 'User 1',
    },
    {
      id: 'team_1_editor',
      firstName: 'Test',
      lastName: 'User 2',
    },
    {
      id: 'team_1_viewer',
      firstName: 'Test',
      lastName: 'User 3',
    },
    {
      id: 'user_without_team',
      firstName: 'Test',
      lastName: 'User 4',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  const user_1 = await createUser({ auth0Id: 'team_1_owner' });
  const user_2 = await createUser({ auth0Id: 'team_1_editor' });
  const user_3 = await createUser({ auth0Id: 'team_1_viewer' });
  await createUser({ auth0Id: 'user_without_team' });

  const team = await createTeam({
    team: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
    },
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
      { userId: user_2.id, role: 'EDITOR' },
      { userId: user_3.id, role: 'VIEWER' },
    ],
    connections: [{ type: 'POSTGRES' }],
  });

  await createFile({
    data: {
      name: 'Test File 1',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
    },
  });
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid', () => {
  describe('get a team you belong to', () => {
    // TODO different responses for OWNER, EDITOR, VIEWER?
    it('responds with a team', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('team');
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');

          expect(res.body.team.settings.analyticsAi).toBe(true);
          expect(res.body.clientDataKv).toStrictEqual({});
          expect(res.body.connections).toHaveLength(2); // 1 created + 1 demo
          expect(res.body.files).toHaveLength(1);
          expect(typeof res.body.files[0].file.creatorId).toBe('number');

          expect(res.body.users[0].email).toBe('team_1_owner@test.com');
          expect(res.body.users[0].role).toBe('OWNER');
          expect(res.body.users[0].name).toBe('Test User 1');

          expect(res.body.users[1].email).toBe('team_1_editor@test.com');
          expect(res.body.users[1].role).toBe('EDITOR');
          expect(res.body.users[1].name).toBe('Test User 2');

          expect(res.body.users[2].email).toBe('team_1_viewer@test.com');
          expect(res.body.users[2].role).toBe('VIEWER');
          expect(res.body.users[2].name).toBe('Test User 3');
        });
    });

    it('does not return archived connections', async () => {
      // delete all connections in a team
      const team = await dbClient.team.findUniqueOrThrow({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
      });
      await dbClient.connection.deleteMany({
        where: {
          teamId: team.id,
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.connections).toHaveLength(1);
          expect(res.body.connections[0].isDemo).toBe(true);
        });
    });

    it('returns team settings including aiRules', async () => {
      // Set team AI rules
      await dbClient.team.update({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
        data: {
          aiRules: 'Team AI rules',
          settingAnalyticsAi: false,
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.team.settings).toHaveProperty('analyticsAi');
          expect(res.body.team.settings).toHaveProperty('aiRules');
          expect(res.body.team.settings.analyticsAi).toBe(false);
          expect(res.body.team.settings.aiRules).toBe('Team AI rules');
        });
    });

    it('returns null for aiRules when not set', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.team.settings.aiRules).toBeNull();
        });
    });
  });
});
