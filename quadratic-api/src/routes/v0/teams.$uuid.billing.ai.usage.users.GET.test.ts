import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import {
  clearDb,
  createAIChat,
  createFile,
  createTeam,
  createUser,
  upgradeTeamToBusiness,
  upgradeTeamToPro,
} from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-0000-0000-000000000050';
const ENDPOINT = `/v0/teams/${teamUuid}/billing/ai/usage/users`;

let ownerId: number;
let editorId: number;
let teamId: number;
let fileId: number;

beforeEach(async () => {
  ownerId = (await createUser({ auth0Id: 'usageUsersOwner' })).id;
  editorId = (await createUser({ auth0Id: 'usageUsersEditor' })).id;
  const team = await createTeam({
    team: { uuid: teamUuid },
    users: [
      { userId: ownerId, role: 'OWNER' },
      { userId: editorId, role: 'EDITOR' },
    ],
  });
  teamId = team.id;

  fileId = (
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000051',
        name: 'Test File',
        ownerTeamId: teamId,
        creatorUserId: ownerId,
      },
    })
  ).id;
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/billing/ai/usage/users', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer InvalidToken usageUsersOwner')
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 200 when the token is valid', async () => {
      await request(app).get(ENDPOINT).set('Authorization', 'Bearer ValidToken usageUsersOwner').expect(200);
    });
  });

  describe('team validation', () => {
    it('responds with a 404 for a non-existent team', async () => {
      await request(app)
        .get('/v0/teams/11111111-1111-1111-1111-111111111111/billing/ai/usage/users')
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(404);
    });

    it('responds with a 403 for a user not in the team', async () => {
      await createUser({ auth0Id: 'usageUsersOutsider' });
      await request(app).get(ENDPOINT).set('Authorization', 'Bearer ValidToken usageUsersOutsider').expect(403);
    });
  });

  describe('free plan', () => {
    it('returns users with zero usage when no messages exist', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.users).toHaveLength(2);
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          const editorUser = body.users.find((u: { userId: number }) => u.userId === editorId);
          expect(ownerUser).toBeDefined();
          expect(editorUser).toBeDefined();
          expect(ownerUser.planType).toBe('FREE');
          expect(ownerUser.currentPeriodUsage).toBe(0);
          expect(ownerUser.billingLimit).toBeDefined();
          expect(ownerUser.currentMonthAiCost).toBeNull();
          expect(ownerUser.monthlyAiAllowance).toBeNull();
          expect(ownerUser.userMonthlyBudgetLimit).toBeNull();
          expect(ownerUser.billedOverageCost).toBeNull();
        });
    });

    it('returns message counts per user', async () => {
      const ownerMessages = Array.from({ length: 5 }, (_, i) => ({
        messageIndex: i,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: ownerId, teamId, fileId, messages: ownerMessages });

      const editorMessages = Array.from({ length: 3 }, (_, i) => ({
        messageIndex: i,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: editorId, teamId, fileId, messages: editorMessages });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          const editorUser = body.users.find((u: { userId: number }) => u.userId === editorId);
          expect(ownerUser.currentPeriodUsage).toBe(5);
          expect(editorUser.currentPeriodUsage).toBe(3);
        });
    });
  });

  describe('pro plan', () => {
    beforeEach(async () => {
      await upgradeTeamToPro(teamId);
    });

    it('returns zero cost when no AI costs exist', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.users).toHaveLength(2);
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          expect(ownerUser.planType).toBe('PRO');
          expect(ownerUser.currentPeriodUsage).toBeNull();
          expect(ownerUser.billingLimit).toBeNull();
          expect(ownerUser.currentMonthAiCost).toBe(0);
          expect(ownerUser.monthlyAiAllowance).toBe(20);
          expect(ownerUser.billedOverageCost).toBe(0);
        });
    });

    it('returns cost per user', async () => {
      await dbClient.aICost.createMany({
        data: [
          {
            userId: ownerId,
            teamId,
            fileId,
            cost: 10.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
          },
          {
            userId: editorId,
            teamId,
            fileId,
            cost: 5.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          const editorUser = body.users.find((u: { userId: number }) => u.userId === editorId);
          expect(ownerUser.currentMonthAiCost).toBe(10);
          expect(editorUser.currentMonthAiCost).toBe(5);
        });
    });
  });

  describe('business plan', () => {
    beforeEach(async () => {
      await upgradeTeamToBusiness(teamId);
    });

    it('returns business plan data with allowance and budget limits', async () => {
      await dbClient.userBudgetLimit.create({
        data: { userId: ownerId, teamId, monthlyBudgetLimit: 60.0 },
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.users).toHaveLength(2);
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          const editorUser = body.users.find((u: { userId: number }) => u.userId === editorId);
          expect(ownerUser.planType).toBe('BUSINESS');
          expect(ownerUser.monthlyAiAllowance).toBe(40);
          expect(ownerUser.userMonthlyBudgetLimit).toBe(60);
          expect(editorUser.userMonthlyBudgetLimit).toBeNull();
        });
    });

    it('returns billed overage cost for users over allowance', async () => {
      await dbClient.team.update({
        where: { id: teamId },
        data: { allowOveragePayments: true },
      });

      await dbClient.aICost.createMany({
        data: [
          {
            userId: ownerId,
            teamId,
            fileId,
            cost: 50.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            overageEnabled: true,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken usageUsersOwner')
        .expect(200)
        .expect(({ body }) => {
          const ownerUser = body.users.find((u: { userId: number }) => u.userId === ownerId);
          expect(ownerUser.currentMonthAiCost).toBe(50);
          expect(ownerUser.billedOverageCost).toBe(10);
        });
    });
  });
});
