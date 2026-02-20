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
  upgradeTeamToPro,
} from '../../tests/testDataGenerator';

let owner1Id: number;
let team1Id: number;
let editor1Id: number;
let fileId: number;

beforeEach(async () => {
  owner1Id = (await createUser({ auth0Id: 'userOwner1' })).id;
  team1Id = (
    await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000000' },
      users: [{ userId: owner1Id, role: 'OWNER' }],
    })
  ).id;

  editor1Id = (await createUser({ auth0Id: 'userEditor1' })).id;
  await dbClient.userTeamRole.create({
    data: { userId: editor1Id, teamId: team1Id, role: 'EDITOR' },
  });

  fileId = (
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000100',
        name: 'Test File',
        ownerTeamId: team1Id,
        creatorUserId: owner1Id,
      },
    })
  ).id;
});

afterEach(clearDb);

const ENDPOINT = '/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage/daily';

describe('GET /v0/teams/:uuid/billing/ai/usage/daily', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer InvalidToken userOwner1')
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 200 when the token is valid', async () => {
      await request(app).get(ENDPOINT).set('Authorization', 'Bearer ValidToken userOwner1').expect(200);
    });
  });

  describe('team validation', () => {
    it('responds with a 404 for a non-existent team', async () => {
      await request(app)
        .get('/v0/teams/11111111-1111-1111-1111-111111111111/billing/ai/usage/daily')
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(404);
    });
  });

  describe('free plan', () => {
    it('returns empty dailyCosts when no usage exists', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts).toEqual([]);
          expect(body.monthlyAiAllowance).toBeNull();
          expect(body.planType).toBe('FREE');
          expect(body.billingPeriodStart).toBeDefined();
          expect(body.billingPeriodEnd).toBeDefined();
        });
    });

    it('returns daily message counts per user', async () => {
      const messages = Array.from({ length: 3 }, (_, i) => ({
        messageIndex: i,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team1Id, fileId, messages });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts.length).toBeGreaterThanOrEqual(1);
          const todayEntry = body.dailyCosts.find((d: { userId: number }) => d.userId === owner1Id);
          expect(todayEntry).toBeDefined();
          expect(todayEntry.value).toBe(3);
          expect(todayEntry.billedOverageCost).toBe(0);
        });
    });
  });

  describe('pro plan', () => {
    beforeEach(async () => {
      await upgradeTeamToPro(team1Id);
    });

    it('returns empty dailyCosts when no costs exist', async () => {
      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts).toEqual([]);
          expect(body.monthlyAiAllowance).toBe(20);
          expect(body.planType).toBe('PRO');
          expect(body.billingPeriodStart).toBeDefined();
          expect(body.billingPeriodEnd).toBeDefined();
        });
    });

    it('returns daily costs per user', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 5.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            createdDate: yesterday,
          },
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 3.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            createdDate: today,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts.length).toBe(2);
          const yesterdayEntry = body.dailyCosts.find(
            (d: { date: string }) => d.date === yesterday.toISOString().split('T')[0]
          );
          const todayEntry = body.dailyCosts.find(
            (d: { date: string }) => d.date === today.toISOString().split('T')[0]
          );
          expect(yesterdayEntry.value).toBe(5);
          expect(todayEntry.value).toBe(3);
        });
    });

    it('does not include costs from outside billing period', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(15);

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 100.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            createdDate: lastMonth,
          },
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 5.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            createdDate: new Date(),
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts.length).toBe(1);
          expect(body.dailyCosts[0].value).toBe(5);
        });
    });

    it('returns data for multiple users', async () => {
      const today = new Date();

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 5.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            createdDate: today,
          },
          {
            userId: editor1Id,
            teamId: team1Id,
            fileId,
            cost: 3.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            createdDate: today,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts.length).toBe(2);
          const ownerEntry = body.dailyCosts.find((d: { userId: number }) => d.userId === owner1Id);
          const editorEntry = body.dailyCosts.find((d: { userId: number }) => d.userId === editor1Id);
          expect(ownerEntry.value).toBe(5);
          expect(editorEntry.value).toBe(3);
        });
    });
  });

  describe('business plan overage tracking', () => {
    beforeEach(async () => {
      await dbClient.team.update({
        where: { id: team1Id },
        data: {
          planType: 'BUSINESS',
          stripeSubscriptionStatus: 'ACTIVE',
          stripeCurrentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          allowOveragePayments: true,
        },
      });
    });

    it('returns billedOverageCost for costs with overageEnabled=true above allowance', async () => {
      const today = new Date();

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 35.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            overageEnabled: false,
            createdDate: today,
          },
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 15.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            overageEnabled: true,
            createdDate: today,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          // Business allowance is $40/user. Total cost is $50.
          // Overage = $10. Only $15 of cost had overageEnabled=true.
          // billedOverageCost = min($10, $15) = $10
          const todayStr = today.toISOString().split('T')[0];
          const entries = body.dailyCosts.filter(
            (d: { date: string; userId: number }) => d.date === todayStr && d.userId === owner1Id
          );
          const totalBilledOverage = entries.reduce(
            (sum: number, d: { billedOverageCost: number }) => sum + d.billedOverageCost,
            0
          );
          expect(totalBilledOverage).toBe(10);
        });
    });

    it('returns 0 billedOverageCost when overageEnabled=false even if over allowance', async () => {
      await dbClient.team.update({
        where: { id: team1Id },
        data: { allowOveragePayments: false },
      });

      await dbClient.aICost.create({
        data: {
          userId: owner1Id,
          teamId: team1Id,
          fileId,
          cost: 50.0,
          model: 'test-model',
          source: 'AIAnalyst',
          inputTokens: 100,
          outputTokens: 100,
          overageEnabled: false,
          createdDate: new Date(),
        },
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          expect(body.dailyCosts.length).toBe(1);
          expect(body.dailyCosts[0].billedOverageCost).toBe(0);
        });
    });

    it('handles mixed overageEnabled records across days', async () => {
      const day1 = new Date();
      day1.setDate(day1.getDate() - 2);
      const day2 = new Date();
      day2.setDate(day2.getDate() - 1);

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 35.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            overageEnabled: false,
            createdDate: day1,
          },
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId,
            cost: 20.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            overageEnabled: true,
            createdDate: day2,
          },
        ],
      });

      await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer ValidToken userOwner1')
        .expect(200)
        .expect(({ body }) => {
          // Day 1: $35 (overageEnabled=false), cumulative=$35, under $40 allowance -> $0 overage
          // Day 2: $20 (overageEnabled=true), cumulative=$55, over by $15 -> billedOverageCost=$15
          const day1Str = day1.toISOString().split('T')[0];
          const day2Str = day2.toISOString().split('T')[0];

          const day1Entry = body.dailyCosts.find((d: { date: string }) => d.date === day1Str);
          const day2Entry = body.dailyCosts.find((d: { date: string }) => d.date === day2Str);

          expect(day1Entry.billedOverageCost).toBe(0);
          expect(day2Entry.billedOverageCost).toBe(15);
        });
    });
  });
});
