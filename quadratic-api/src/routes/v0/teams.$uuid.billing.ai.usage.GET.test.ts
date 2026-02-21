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
let owner2Id: number;
let team2Id: number;

beforeEach(async () => {
  // Create some users
  owner1Id = (
    await createUser({
      auth0Id: 'userOwner1',
    })
  ).id;
  team1Id = (
    await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000000',
      },
      users: [{ userId: owner1Id, role: 'OWNER' }],
    })
  ).id;

  owner2Id = (
    await createUser({
      auth0Id: 'userOwner2',
    })
  ).id;
  team2Id = (
    await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000001',
      },
      users: [{ userId: owner2Id, role: 'OWNER' }],
    })
  ).id;
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/billing/ai/usage', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer InvalidToken userOwner1`)
        .expect(401)
        .expect(expectError);
    });
    it('responds with a 200 when the token is valid', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 0,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 0,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });
  });

  describe('team uuid', () => {
    it('responds with a 404 for a team that isn\u2019t in the system', async () => {
      await request(app)
        .get('/v0/teams/11111111-1111-1111-1111-111111111111/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(404)
        .expect(({ body }) => {
          expect(body).toEqual({
            error: {
              message: 'Team not found',
            },
          });
        });
    });
    it('responds with a 200 for a valid team uuid and the user belongs to this team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 0,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 0,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });
    it('responds with a 403 for a valid team uuid and user does not belong to this team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(403);
    });
  });

  describe('usage not exceeded', () => {
    it("check usage in user's free team", async () => {
      const messages = Array.from({ length: 5 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team1Id, messages });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 5,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 5,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });

    it('responds with 403 for usage check in foreign team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(403);
    });
  });

  describe('usage exceeded', () => {
    it("user's free team", async () => {
      const messages = Array.from({ length: 21 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team1Id, messages });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 21,
            exceededBillingLimit: true,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 21,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });
    it("user's paid team", async () => {
      const messages = Array.from({ length: 23 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team1Id, messages });
      await upgradeTeamToPro(team1Id);

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            exceededBillingLimit: false,
            billingLimit: null,
            currentPeriodUsage: null,
            planType: 'PRO',
            currentMonthAiCost: 0,
            monthlyAiAllowance: 20,
            remainingAllowance: 20,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,

            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: null,
            userCurrentMonthCost: null,
            allowOveragePayments: false,
            billingPeriodStart: expect.any(String),
            billingPeriodEnd: expect.any(String),
          });
        });
    });
    it('responds with 403 for foreign free team (user not a member)', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(403);
    });
    it('responds with 403 for foreign paid team (user not a member)', async () => {
      await upgradeTeamToPro(team2Id);

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(403);
    });
  });

  describe('monthly reset - usage from previous month does not count', () => {
    const getLastMonth = () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      d.setDate(15);
      return d;
    };

    it('Free plan: messages from previous month are not counted', async () => {
      const messages = Array.from({ length: 21 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      const chat = await createAIChat({ userId: owner1Id, teamId: team1Id, messages });

      await dbClient.analyticsAIChat.update({
        where: { id: chat.id },
        data: { createdDate: getLastMonth() },
      });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 0,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 0,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });

    it('Free plan: only current month messages count when messages span months', async () => {
      const lastMonthMessages = Array.from({ length: 21 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      const lastMonthChat = await createAIChat({ userId: owner1Id, teamId: team1Id, messages: lastMonthMessages });

      await dbClient.analyticsAIChat.update({
        where: { id: lastMonthChat.id },
        data: { createdDate: getLastMonth() },
      });

      const currentMonthMessages = Array.from({ length: 5 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team1Id, messages: currentMonthMessages });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 5,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,
            teamCurrentMonthMessages: 5,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });

    it('Pro plan: costs from previous month are not counted', async () => {
      await upgradeTeamToPro(team1Id);

      const file = await createFile({
        data: {
          uuid: '00000000-0000-0000-0000-000000000100',
          name: 'Test File',
          ownerTeamId: team1Id,
          creatorUserId: owner1Id,
        },
      });

      await dbClient.aICost.create({
        data: {
          userId: owner1Id,
          teamId: team1Id,
          fileId: file.id,
          cost: 25.0,
          model: 'test-model',
          source: 'AIAnalyst',
          inputTokens: 100,
          outputTokens: 100,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          createdDate: getLastMonth(),
        },
      });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            exceededBillingLimit: false,
            billingLimit: null,
            currentPeriodUsage: null,
            planType: 'PRO',
            currentMonthAiCost: 0,
            monthlyAiAllowance: 20,
            remainingAllowance: 20,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,

            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: null,
            userCurrentMonthCost: null,
            allowOveragePayments: false,
            billingPeriodStart: expect.any(String),
            billingPeriodEnd: expect.any(String),
          });
        });
    });

    it('Pro plan: only current month costs count when costs span months', async () => {
      await upgradeTeamToPro(team1Id);

      const file = await createFile({
        data: {
          uuid: '00000000-0000-0000-0000-000000000101',
          name: 'Test File',
          ownerTeamId: team1Id,
          creatorUserId: owner1Id,
        },
      });

      await dbClient.aICost.createMany({
        data: [
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId: file.id,
            cost: 25.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 100,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            createdDate: getLastMonth(),
          },
          {
            userId: owner1Id,
            teamId: team1Id,
            fileId: file.id,
            cost: 10.0,
            model: 'test-model',
            source: 'AIAnalyst',
            inputTokens: 50,
            outputTokens: 50,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            createdDate: new Date(),
          },
        ],
      });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            exceededBillingLimit: false,
            billingLimit: null,
            currentPeriodUsage: null,
            planType: 'PRO',
            currentMonthAiCost: 10,
            monthlyAiAllowance: 20,
            remainingAllowance: 10,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthOverageCost: null,

            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: null,
            userCurrentMonthCost: null,
            allowOveragePayments: false,
            billingPeriodStart: expect.any(String),
            billingPeriodEnd: expect.any(String),
          });
        });
    });

    it('Business plan: all budgets reset at month boundary', async () => {
      await dbClient.team.update({
        where: { id: team1Id },
        data: {
          planType: 'BUSINESS',
          stripeSubscriptionStatus: 'ACTIVE',
          stripeCurrentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          allowOveragePayments: true,
          teamMonthlyBudgetLimit: 50.0,
        },
      });

      await dbClient.userBudgetLimit.create({
        data: { userId: owner1Id, teamId: team1Id, monthlyBudgetLimit: 60.0 },
      });

      const file = await createFile({
        data: {
          uuid: '00000000-0000-0000-0000-000000000102',
          name: 'Test File',
          ownerTeamId: team1Id,
          creatorUserId: owner1Id,
        },
      });

      await dbClient.aICost.create({
        data: {
          userId: owner1Id,
          teamId: team1Id,
          fileId: file.id,
          cost: 200.0,
          model: 'test-model',
          source: 'AIAnalyst',
          inputTokens: 100,
          outputTokens: 100,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          createdDate: getLastMonth(),
        },
      });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000000/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            exceededBillingLimit: false,
            billingLimit: null,
            currentPeriodUsage: null,
            planType: 'BUSINESS',
            currentMonthAiCost: 0,
            monthlyAiAllowance: 40,
            remainingAllowance: 40,
            teamMonthlyBudgetLimit: 50.0,
            teamCurrentMonthOverageCost: 0,

            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: 60.0,
            userCurrentMonthCost: 0,
            allowOveragePayments: true,
            billingPeriodStart: expect.any(String),
            billingPeriodEnd: expect.any(String),
          });
        });
    });
  });
});
