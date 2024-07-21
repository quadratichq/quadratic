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

  // Create a team with an invite
  const team = await dbClient.team.create({
    data: {
      name: 'Test Team',
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
            email: 'johndoe@example.com',
            role: 'EDITOR',
          },
        ],
      },
    },
  });

  // Create a file with an invite
  await createFile({
    data: {
      name: 'Test File 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      creatorUserId: user1.id,
      ownerUserId: user1.id,
      ownerTeamId: team.id,
      FileInvite: {
        create: [
          {
            email: 'johndoe@example.com',
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
              email: 'johndoe@example.com',
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

describe('A user coming in to the system for the first time and accessing _any_ endpoint', () => {
  describe('user with outstanding invite to team/file', () => {
    it('creates user in the database and associates them with outstanding invites to team/file', async () => {
      // State before
      const userBefore = await dbClient.user.findUnique({
        where: {
          auth0Id: 'firstTimeUser',
        },
      });
      expect(userBefore).toBe(null);

      const teamInvitesBefore = await dbClient.teamInvite.findMany({
        where: {
          email: 'johndoe@example.com',
        },
      });
      expect(teamInvitesBefore.length).toBe(1);

      const fileInvitesBefore = await dbClient.fileInvite.findMany({
        where: {
          email: 'johndoe@example.com',
        },
      });
      expect(fileInvitesBefore.length).toBe(1);

      // Make request
      await request(app)
        .get('/v0/education')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken firstTimeUser`)
        .expect(200);

      // State after
      const userAfter = await dbClient.user.findUnique({
        where: {
          auth0Id: 'firstTimeUser',
        },
      });
      expect(userAfter).toHaveProperty('id');
      expect(userAfter).toHaveProperty('auth0Id');

      const teamInvitesAfter = await dbClient.teamInvite.findMany({
        where: {
          email: 'johndoe@example.com',
        },
      });
      expect(teamInvitesAfter.length).toBe(0);

      const fileInvitesAfter = await dbClient.fileInvite.findMany({
        where: {
          email: 'johndoe@example.com',
        },
      });
      expect(fileInvitesAfter.length).toBe(0);
    });
  });
});
