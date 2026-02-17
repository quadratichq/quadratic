import request from 'supertest';
import { app } from '../../app';
import { expectError } from '../../tests/helpers';
import { clearDb, createAIChat, createTeam, createUser, upgradeTeamToPro } from '../../tests/testDataGenerator';

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
            teamCurrentMonthCost: null,
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
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: 0,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });
    it('responds with a 200 for a valid team uuid and user does not belong to this team', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
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
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: 0,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
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
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: 5,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });

    it('check usage in foreign team', async () => {
      const messages = Array.from({ length: 7 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team2Id, messages });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            billingLimit: 20,
            currentPeriodUsage: 7,
            exceededBillingLimit: false,
            planType: 'FREE',
            currentMonthAiCost: null,
            monthlyAiAllowance: null,
            remainingAllowance: null,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: 7,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
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
            teamCurrentMonthCost: null,
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
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: null,
            userCurrentMonthCost: null,
            allowOveragePayments: false,
          });
        });
    });
    it('foreign free team', async () => {
      const messages = Array.from({ length: 21 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team2Id, messages });

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
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
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: 21,
            teamMessageLimit: 20,
            userMonthlyBudgetLimit: null,
            allowOveragePayments: false,
          });
        });
    });
    it('foreign paid team', async () => {
      const messages = Array.from({ length: 23 }, (_, index) => ({
        messageIndex: index,
        model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
        messageType: 'userPrompt' as const,
      }));
      await createAIChat({ userId: owner1Id, teamId: team2Id, messages });
      await upgradeTeamToPro(team2Id);

      await request(app)
        .get('/v0/teams/00000000-0000-0000-0000-000000000001/billing/ai/usage')
        .set('Authorization', `Bearer ValidToken userOwner1`)
        .expect(200)
        .expect(({ body }) => {
          // User is not a member of team2, so they see the paid team response
          // with cost-based limits. No AICost records exist, so cost is 0.
          expect(body).toEqual({
            exceededBillingLimit: false,
            billingLimit: null,
            currentPeriodUsage: null,
            planType: 'PRO',
            currentMonthAiCost: 0,
            monthlyAiAllowance: 20,
            remainingAllowance: 20,
            teamMonthlyBudgetLimit: null,
            teamCurrentMonthCost: null,
            teamCurrentMonthMessages: null,
            teamMessageLimit: null,
            userMonthlyBudgetLimit: null,
            userCurrentMonthCost: null,
            allowOveragePayments: false,
          });
        });
    });
  });
});
