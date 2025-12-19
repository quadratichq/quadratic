import { workosMock } from '../tests/workosMock';
jest.mock('@workos-inc/node', () => workosMock([{ id: 'firstTimeUser' }, { id: 'user1' }]));

import request from 'supertest';
import { app } from '../app';
import dbClient from '../dbClient';
import { clearDb, createFile, createUser } from '../tests/testDataGenerator';

beforeEach(async () => {
  // Create a user
  const user1 = await createUser({ auth0Id: 'user1' });

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
            email: 'firsttimeuser@test.com',
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
            email: 'firsttimeuser@test.com',
            role: 'EDITOR',
          },
        ],
      },
    },
  });
});

afterEach(clearDb);

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
          email: 'firsttimeuser@test.com',
        },
      });
      expect(teamInvitesBefore.length).toBe(1);

      const fileInvitesBefore = await dbClient.fileInvite.findMany({
        where: {
          email: 'firsttimeuser@test.com',
        },
      });
      expect(fileInvitesBefore.length).toBe(1);

      // Make request
      try {
        await request(app)
          .get('/v0/education')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ValidToken firstTimeUser`)
          .expect(200);
      } catch (error) {
        console.log(error);
        throw error;
      }

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
          email: 'firsttimeuser@test.com',
        },
      });
      expect(teamInvitesAfter.length).toBe(1);
      expect(teamInvitesAfter[0].status).toBe('ACCEPTED');

      const fileInvitesAfter = await dbClient.fileInvite.findMany({
        where: {
          email: 'firsttimeuser@test.com',
        },
      });
      expect(fileInvitesAfter.length).toBe(1);
      expect(fileInvitesAfter[0].status).toBe('ACCEPTED');
    });
  });
});
