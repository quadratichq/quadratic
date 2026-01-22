import { SubscriptionStatus } from '@prisma/client';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

const TEAM_UUID = '00000000-0000-4000-8000-000000000001';
const ANOTHER_TEAM_UUID = '00000000-0000-4000-8000-000000000002';

// Mock FREE_EDITABLE_FILE_LIMIT for testing
jest.mock('../../env-vars', () => ({
  ...jest.requireActual('../../env-vars'),
  FREE_EDITABLE_FILE_LIMIT: 3,
  // Keep MAX_FILE_COUNT_FOR_PAID_PLAN for deprecated hasReachedFileLimit function
  MAX_FILE_COUNT_FOR_PAID_PLAN: [3, 2],
}));

beforeEach(async () => {
  const user_1 = await createUser({ auth0Id: 'team_1_owner' });
  const user_2 = await createUser({ auth0Id: 'team_1_editor' });
  const user_without_team = await createUser({ auth0Id: 'user_without_team' });

  const team = await createTeam({
    team: {
      name: 'Test Team 1',
      uuid: TEAM_UUID,
    },
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
      { userId: user_2.id, role: 'EDITOR' },
    ],
  });

  // Create another team for testing unauthorized access
  await createTeam({
    team: {
      name: 'Test Team 2',
      uuid: ANOTHER_TEAM_UUID,
    },
    users: [
      {
        userId: user_without_team.id,
        role: 'OWNER',
      },
    ],
  });

  // Create 2 team files (below limit of 3)
  await createFile({
    data: {
      name: 'Team File 1',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
      ownerUserId: null,
    },
  });
  await createFile({
    data: {
      name: 'Team File 2',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
      ownerUserId: null,
    },
  });

  // Create 1 private file for user_1 (below limit of 2)
  await createFile({
    data: {
      name: 'Private File 1',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
      ownerUserId: user_1.id,
    },
  });
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/file-limit', () => {
  describe('team files (private=false)', () => {
    it('returns hasReachedLimit=false when team has not reached the limit', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: false });
        });
    });

    it('returns hasReachedLimit=true when team has reached the limit', async () => {
      // Add one more team file to reach the limit of 3
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Team File 3',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: true });
        });
    });

    it('returns hasReachedLimit=false when team is on paid plan regardless of file count', async () => {
      // Add files to exceed the limit
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Team File 3',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      // Update team to be on paid plan
      await dbClient.team.update({
        where: { uuid: TEAM_UUID },
        data: {
          stripeSubscriptionStatus: SubscriptionStatus.ACTIVE,
          stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: false });
        });
    });

    it('does not count deleted files', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 3 more files to exceed the limit
      const file3 = await createFile({
        data: {
          name: 'Team File 3',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      // Mark one as deleted
      await dbClient.file.update({
        where: { uuid: file3.uuid },
        data: { deleted: true },
      });

      // Should still be at limit (3 non-deleted files)
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: true });
        });
    });
  });

  describe('private files (private=true)', () => {
    it('returns hasReachedLimit=false when user has not reached private file limit', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: false });
        });
    });

    it('returns hasReachedLimit=true when user has reached private file limit', async () => {
      // Add one more private file to reach the limit of 2
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Private File 2',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: user.id,
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: true });
        });
    });

    it('only counts private files for the requesting user', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });

      const user_2 = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_editor' },
      });

      // Add 2 private files for user_2
      await createFile({
        data: {
          name: 'Private File for User 2 - 1',
          ownerTeamId: team.id,
          creatorUserId: user_2.id,
          ownerUserId: user_2.id,
        },
      });
      await createFile({
        data: {
          name: 'Private File for User 2 - 2',
          ownerTeamId: team.id,
          creatorUserId: user_2.id,
          ownerUserId: user_2.id,
        },
      });

      // User 1 should still be below the limit (only has 1 private file)
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: false });
        });

      // User 2 should have reached the limit (has 2 private files)
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=true`)
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: true });
        });
    });

    it('returns hasReachedLimit=false when team is on paid plan regardless of file count', async () => {
      // Add files to exceed the limit
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Private File 2',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: user.id,
        },
      });
      await createFile({
        data: {
          name: 'Private File 3',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: user.id,
        },
      });

      // Update team to be on paid plan
      await dbClient.team.update({
        where: { uuid: TEAM_UUID },
        data: {
          stripeSubscriptionStatus: SubscriptionStatus.ACTIVE,
          stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasReachedLimit: false });
        });
    });
  });

  describe('error cases', () => {
    it('returns 400 for invalid UUID', async () => {
      await request(app)
        .get(`/v0/teams/invalid-uuid/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });

    it('returns 400 for missing private query parameter', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });

    it('returns 400 for invalid private query parameter', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=invalid`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });

    it('returns 403 when user is not a member of the team', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken user_without_team`)
        .expect(403);
    });

    it('returns 401 without authentication', async () => {
      await request(app).get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`).expect(401);
    });
  });

  describe('different user roles', () => {
    it('allows EDITOR to check file limits', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit?private=false`)
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('hasReachedLimit');
        });
    });
  });
});
