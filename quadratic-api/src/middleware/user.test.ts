import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';
import { createFile } from '../tests/testDataGenerator';

beforeEach(async () => {
  // Create a user
  const user1 = await dbClient.user.create({
    data: {
      auth0Id: 'user1',
    },
  });

  // Create a file with an invite
  await createFile({
    data: {
      name: 'Test File 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      creatorUserId: user1.id,
      ownerUserId: user1.id,
      FileInvite: {
        create: [
          {
            email: 'johnDoe@example.com',
            role: 'EDITOR',
          },
        ],
      },
    },
  });

  // Create a team with an invite
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000002',
      UserTeamRole: {
        create: [
          {
            userId: user1.id,
            role: 'OWNER',
          },
        ],
      },
      TeamInvite: {
        create: [
          {
            email: 'johnDoe@example.com',
            role: 'EDITOR',
          },
        ],
      },
    },
  });
});

afterEach(async () => {
  await dbClient.$transaction([
    dbClient.fileInvite.deleteMany(),
    dbClient.teamInvite.deleteMany(),
    dbClient.userTeamRole.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
    dbClient.team.deleteMany(),
  ]);
});

jest.mock('auth0', () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => {
      return {
        getUsers: jest.fn().mockImplementation(({ q }: { q: string }) => {
          // example value for `q`: "user_id:(user1 OR user2)"
          const auth0Users = [
            {
              user_id: 'firstTimeUser',
              email: 'johnDoe@example.com',
              name: 'Test User 1',
            },
            {
              user_id: 'user1',
              email: 'user1@example.com',
            },
          ];
          return auth0Users.filter(({ user_id }) => q.includes(user_id));
        }),
      };
    }),
  };
});

describe('A user coming in to the system for the first time', () => {
  describe('accessing _any_ endpoint', () => {
    it('creates the user in the database', async () => {
      const userBefore = await dbClient.user.findUnique({
        where: {
          auth0Id: 'firstTimeUser',
        },
      });
      expect(userBefore).toBe(null);
      await request(app)
        .get('/v0/files')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken firstTimeUser`)
        .expect(200);
      const userAfter = await dbClient.user.findUnique({
        where: {
          auth0Id: 'firstTimeUser',
        },
      });
      expect(userAfter).toHaveProperty('id');
      expect(userAfter).toHaveProperty('auth0Id');
    });
  });
  describe('accessing a team', () => {
    it('deletes invites when they log in and gives them access', async () => {
      const invitesBefore = await dbClient.teamInvite.findMany({
        where: {
          email: 'johnDoe@example.com',
        },
      });
      expect(invitesBefore.length).toBe(1);
      await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000002')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken firstTimeUser`)
        .expect(200);
      const invitesAfter = await dbClient.teamInvite.findMany({
        where: {
          email: 'johnDoe@example.com',
        },
      });
      expect(invitesAfter.length).toBe(0);
    });
  });
  describe('accessing a file', () => {
    it('deletes invites when they log in and gives them access', async () => {
      const invitesBefore = await dbClient.fileInvite.findMany({
        where: {
          email: 'johnDoe@example.com',
        },
      });
      expect(invitesBefore.length).toBe(1);
      await request(app)
        .get('/v0/files/00000000-0000-4000-8000-000000000001')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken firstTimeUser`)
        .expect(200);
      const invitesAfter = await dbClient.fileInvite.findMany({
        where: {
          email: 'johnDoe@example.com',
        },
      });
      expect(invitesAfter.length).toBe(0);
    });
  });
});
