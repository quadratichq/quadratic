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
  FREE_EDITABLE_FILE_LIMIT: 5,
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

  // Create 3 team files (below limit of 5)
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
  await createFile({
    data: {
      name: 'Team File 3',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
      ownerUserId: null,
    },
  });

  // Create 1 private file for user_1
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
  describe('file limits', () => {
    it('returns hasReachedLimit=false when team has not reached the limit', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.hasReachedLimit).toBe(false);
          expect(res.body.isOverLimit).toBe(false);
          expect(res.body.isPaidPlan).toBe(false);
          expect(res.body.totalFiles).toBe(4); // 3 team files + 1 private file
          expect(res.body.maxEditableFiles).toBe(5);
        });
    });

    it('returns hasReachedLimit=true but isOverLimit=false when team is at exactly the limit', async () => {
      // Add one more team file to reach the limit of 5 (we already have 4 total: 3 team + 1 private)
      // So now we'll have 5 total files
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          // hasReachedLimit=true: can't create more files (at limit)
          // isOverLimit=false: all 5 files are still editable (not over limit)
          expect(res.body.hasReachedLimit).toBe(true);
          expect(res.body.isOverLimit).toBe(false);
          expect(res.body.isPaidPlan).toBe(false);
          expect(res.body.totalFiles).toBe(5);
          expect(res.body.maxEditableFiles).toBe(5);
        });
    });

    it('returns both hasReachedLimit=true and isOverLimit=true when team is over the limit', async () => {
      // Add 2 more files to exceed the limit (we already have 4 total: 3 team + 1 private)
      // So now we'll have 6 total files (over limit of 5)
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      await createFile({
        data: {
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 5',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.hasReachedLimit).toBe(true);
          expect(res.body.isOverLimit).toBe(true);
          expect(res.body.isPaidPlan).toBe(false);
          expect(res.body.totalFiles).toBe(6);
          expect(res.body.maxEditableFiles).toBe(5);
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
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 5',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 6',
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
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.hasReachedLimit).toBe(false);
          expect(res.body.isOverLimit).toBe(false);
          expect(res.body.isPaidPlan).toBe(true);
          expect(res.body.totalFiles).toBe(7);
          expect(res.body.maxEditableFiles).toBeUndefined(); // Paid teams don't have a limit
        });
    });

    it('does not count deleted files', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: TEAM_UUID },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 3 more files to exceed the limit (we already have 4 total)
      const file5 = await createFile({
        data: {
          name: 'Team File 4',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 5',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });
      await createFile({
        data: {
          name: 'Team File 6',
          ownerTeamId: team.id,
          creatorUserId: user.id,
          ownerUserId: null,
        },
      });

      // Mark one as deleted
      await dbClient.file.update({
        where: { uuid: file5.uuid },
        data: { deleted: true },
      });

      // Should have 6 non-deleted files (exceeds limit of 5)
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.hasReachedLimit).toBe(true);
          expect(res.body.isOverLimit).toBe(true);
          expect(res.body.isPaidPlan).toBe(false);
          expect(res.body.totalFiles).toBe(6); // 7 created - 1 deleted = 6
          expect(res.body.maxEditableFiles).toBe(5);
        });
    });
  });

  describe('error cases', () => {
    it('returns 400 for invalid UUID', async () => {
      await request(app)
        .get(`/v0/teams/invalid-uuid/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400);
    });

    it('returns 403 when user is not a member of the team', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken user_without_team`)
        .expect(403);
    });

    it('returns 401 without authentication', async () => {
      await request(app).get(`/v0/teams/${TEAM_UUID}/file-limit`).expect(401);
    });
  });

  describe('different user roles', () => {
    it('allows EDITOR to check file limits', async () => {
      await request(app)
        .get(`/v0/teams/${TEAM_UUID}/file-limit`)
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('hasReachedLimit');
          expect(res.body).toHaveProperty('isOverLimit');
          expect(res.body).toHaveProperty('totalFiles');
          expect(res.body).toHaveProperty('isPaidPlan');
        });
    });
  });
});
