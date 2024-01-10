import { User } from 'auth0';
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
          { userId: user_2.id, role: 'EDITOR' },
          { userId: user_3.id, role: 'VIEWER' },
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

jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsers: jest.fn().mockImplementation(({ q }) => {
          // Pull the lsit of users from the query
          // 'user_id:(team_1_owner OR team_1_editor OR team_1_viewer)'
          const regex = /user_id:\((.*)\)/;
          const match = q.match(regex);
          if (!match) {
            return [];
          }
          const ids = match[1].split(' OR ');

          const users: User[] = [
            {
              user_id: 'team_1_owner',
              email: 'team_1_owner@example.com',
              // picture: null,
              name: 'Test User 1',
            },
            {
              user_id: 'team_1_editor',
              email: 'team_1_editor@example.com',
              // picture: null,
              name: 'Test User 2',
            },
            {
              user_id: 'team_1_viewer',
              email: 'team_1_viewer@example.com',
              // picture: null,
              name: 'Test User 3',
            },
            {
              user_id: 'user_without_team',
              email: 'user_without_team@example.com',
              // picture: null,
              name: 'Test User 4',
            },
          ];

          return users.filter((user) => ids.includes(user.user_id));
        }),
      };
    }),
  };
});

describe('GET /v0/teams/:uuid', () => {
  // TODO the auth/team middleware should handle all this...?
  describe('sending a bad request', () => {
    it.todo('responds with a 401 without authentication');
    it.todo('responds with a 404 for requesting a team that doesn’t exist');
    it.todo('responds with a 400 for failing schema validation on the team UUID');
    it.todo('responds with a 400 for failing schema validation on the payload');
  });

  describe('get a team you belong to', () => {
    // TODO different responses for OWNER, EDITOR, VIEWER?
    it('responds with a team', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect('Content-Type', /json/)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('team');
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');
          expect(res.body.team.name).toBe('Test Team 1');

          expect(res.body.team.users[0].email).toBe('team_1_owner@example.com');
          expect(res.body.team.users[0].role).toBe('OWNER');
          expect(res.body.team.users[0].name).toBe('Test User 1');

          expect(res.body.team.users[1].email).toBe('team_1_editor@example.com');
          expect(res.body.team.users[1].role).toBe('EDITOR');
          expect(res.body.team.users[1].name).toBe('Test User 2');

          expect(res.body.team.users[2].email).toBe('team_1_viewer@example.com');
          expect(res.body.team.users[2].role).toBe('VIEWER');
          expect(res.body.team.users[2].name).toBe('Test User 3');

          // TODO files
          // expect(res.body.team).toHaveProperty('files');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('id');
          expect(res.body.user.role).toBe('OWNER');
          expect(res.body.user.permissions).toEqual(
            expect.arrayContaining(['TEAM_EDIT', 'TEAM_VIEW', 'TEAM_DELETE', 'TEAM_BILLING_EDIT'])
          );
        });
    });
  });
});
